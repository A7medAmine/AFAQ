import { Router } from 'express'
import { supabaseAdmin } from '../db/client.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { isEmailConfigured, sendEmail } from '../services/mailer.js'
import {
  buildSharedVariables, memberVariables, renderEmail, EMAIL_LANGUAGES,
} from '../../src/lib/emailTemplate.js'

const router = Router()

/** Same people who can publish announcements in the console. */
router.use(requireAuth, requireRole('event_manager', 'media_manager', 'project_manager'))

// A batch has to finish inside one serverless invocation, so keep it small.
const BATCH_SIZE = 20
const CONCURRENCY = 4
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const LANGUAGES = EMAIL_LANGUAGES.map(l => l.value)
const TEMPLATE_FIELDS = [
  'name', 'kind', 'subject', 'header_text', 'heading', 'body',
  'button_label', 'button_url', 'footer', 'accent_color', 'custom_html',
]
const SOURCE_TABLES = { announcement: 'announcements', event: 'events' }

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status }
}

const fail = (res, err, fallback) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message })
  console.error(fallback, err)
  return res.status(500).json({ error: fallback })
}

const siteUrl = req => process.env.VITE_APP_URL || req.headers.origin || ''

function normalizeAudience(raw = {}) {
  const strings = v => (Array.isArray(v) ? v.filter(x => typeof x === 'string' && x.trim()).map(x => x.trim()) : [])
  const statuses = strings(raw.statuses)
  return {
    statuses: statuses.length ? statuses : ['active'],
    teams: strings(raw.teams),
    groupIds: (Array.isArray(raw.groupIds) ? raw.groupIds : []).map(Number).filter(Number.isInteger),
  }
}

/** Page through members (PostgREST caps a response at 1000 rows). */
async function fetchAllMembers(columns) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from('members').select(columns).order('id').range(from, from + 999)
    if (error) throw error
    rows.push(...data)
    if (data.length < 1000) return rows
  }
}

/** Members matching the audience, deduplicated by address, opted-out ones set aside. */
async function resolveRecipients(audience) {
  const members = await fetchAllMembers('id, full_name, email, member_code, status, team, email_opt_out')

  let inGroups = null
  if (audience.groupIds.length) {
    const { data, error } = await supabaseAdmin
      .from('member_group_members').select('member_id').in('group_id', audience.groupIds)
    if (error) throw error
    inGroups = new Set(data.map(r => r.member_id))
  }

  const seen = new Set()
  const recipients = []
  let optedOut = 0
  for (const m of members) {
    if (!audience.statuses.includes(m.status || 'active')) continue
    if (audience.teams.length && !audience.teams.includes(m.team)) continue
    if (inGroups && !inGroups.has(m.id)) continue
    const email = String(m.email || '').trim().toLowerCase()
    if (!EMAIL.test(email) || seen.has(email)) continue
    seen.add(email)
    if (m.email_opt_out) { optedOut += 1; continue }
    recipients.push({ ...m, email })
  }
  return { recipients, optedOut }
}

/**
 * Turn a composer request into what rendering needs: the template snapshot,
 * the variables shared by every recipient, and the language.
 */
async function prepare(body, req) {
  const language = LANGUAGES.includes(body.language) ? body.language : 'en'

  const { data: row, error } = await supabaseAdmin
    .from('email_templates').select('*').eq('id', Number(body.templateId)).maybeSingle()
  if (error) throw error
  if (!row) throw new HttpError(400, 'Choose a template.')
  const template = Object.fromEntries(TEMPLATE_FIELDS.map(k => [k, row[k] ?? null]))
  if (typeof body.subject === 'string' && body.subject.trim()) template.subject = body.subject.trim()

  const sourceType = SOURCE_TABLES[body.sourceType] ? body.sourceType : null
  let record = null
  if (sourceType) {
    const { data, error: sourceError } = await supabaseAdmin
      .from(SOURCE_TABLES[sourceType]).select('*').eq('id', Number(body.sourceId)).maybeSingle()
    if (sourceError) throw sourceError
    if (!data) throw new HttpError(404, `That ${sourceType} no longer exists.`)
    record = data
  } else {
    const title = String(body.message?.title || '').trim()
    const content = String(body.message?.content || '').trim()
    if (!title || !content) throw new HttpError(400, 'Write a title and a message.')
  }

  const variables = buildSharedVariables({
    sourceType, record, message: body.message, language, siteUrl: siteUrl(req),
  })
  return { template, templateId: row.id, variables, language, sourceType, sourceId: record?.id ?? null }
}

function requireSmtp() {
  if (!isEmailConfigured()) {
    throw new HttpError(503, 'Email is not configured on the server. Set SMTP_USER and SMTP_PASS.')
  }
}

// --- Audience ---

router.get('/audience-options', async (req, res) => {
  try {
    const [members, groups, links] = await Promise.all([
      fetchAllMembers('id, status, team, email_opt_out'),
      supabaseAdmin.from('member_groups').select('id, name').order('name'),
      supabaseAdmin.from('member_group_members').select('group_id'),
    ])
    if (groups.error) throw groups.error
    if (links.error) throw links.error

    const tally = key => {
      const counts = {}
      for (const m of members) {
        const value = key === 'status' ? m.status || 'active' : m[key]
        if (value) counts[value] = (counts[value] || 0) + 1
      }
      return Object.entries(counts).map(([value, count]) => ({ value, count }))
        .sort((a, b) => a.value.localeCompare(b.value))
    }
    const groupCounts = {}
    for (const l of links.data) groupCounts[l.group_id] = (groupCounts[l.group_id] || 0) + 1

    res.json({
      statuses: tally('status'),
      teams: tally('team'),
      groups: groups.data.map(g => ({ ...g, count: groupCounts[g.id] || 0 })),
      emailConfigured: isEmailConfigured(),
    })
  } catch (err) {
    fail(res, err, 'Could not load the member list.')
  }
})

router.post('/audience/count', async (req, res) => {
  try {
    const { recipients, optedOut } = await resolveRecipients(normalizeAudience(req.body?.audience))
    res.json({ count: recipients.length, optedOut })
  } catch (err) {
    fail(res, err, 'Could not count recipients.')
  }
})

// --- Test send (to the signed-in admin) ---

router.post('/test', async (req, res) => {
  try {
    requireSmtp()
    const prepared = await prepare(req.body || {}, req)
    const to = req.user.email
    if (!to) throw new HttpError(400, 'Your account has no email address.')
    const { subject, html } = renderEmail(prepared.template, {
      ...prepared.variables,
      ...memberVariables({ full_name: req.adminProfile?.full_name || to.split('@')[0] }),
    }, { language: prepared.language })
    await sendEmail({ to, subject: `[Test] ${subject}`, html })
    res.json({ ok: true, to })
  } catch (err) {
    fail(res, err, 'The test email was not sent.')
  }
})

// --- Campaigns ---

router.post('/campaigns', async (req, res) => {
  try {
    requireSmtp()
    const body = req.body || {}
    const prepared = await prepare(body, req)
    const audience = normalizeAudience(body.audience)
    const { recipients } = await resolveRecipients(audience)
    if (!recipients.length) throw new HttpError(400, 'No member matches this audience.')

    const { data: campaign, error } = await supabaseAdmin
      .from('email_campaigns')
      .insert({
        subject: renderEmail(prepared.template, prepared.variables, { language: prepared.language }).subject,
        template_id: prepared.templateId,
        template: prepared.template,
        variables: prepared.variables,
        source_type: prepared.sourceType,
        source_id: prepared.sourceId,
        language: prepared.language,
        audience,
        total: recipients.length,
        status: 'queued',
        created_by: req.user.id,
      })
      .select()
      .single()
    if (error) throw error

    for (let i = 0; i < recipients.length; i += 500) {
      const { error: insertError } = await supabaseAdmin.from('email_deliveries').insert(
        recipients.slice(i, i + 500).map(m => ({
          campaign_id: campaign.id, member_id: m.id, email: m.email, name: m.full_name,
        }))
      )
      if (insertError) {
        await supabaseAdmin.from('email_campaigns').delete().eq('id', campaign.id)
        throw insertError
      }
    }

    supabaseAdmin.from('activity_logs').insert({
      user_id: req.user.id, action: 'emailed', entity_type: 'email_campaigns', entity_id: campaign.id,
      metadata: { name: campaign.subject, recipients: recipients.length },
    }).then(() => {}, () => {})

    res.json(campaign)
  } catch (err) {
    fail(res, err, 'The email could not be queued.')
  }
})

async function countByStatus(campaignId) {
  const count = async status => {
    const { count: n, error } = await supabaseAdmin
      .from('email_deliveries').select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaignId).eq('status', status)
    if (error) throw error
    return n || 0
  }
  const [queued, sending, sent, failed] = await Promise.all(['queued', 'sending', 'sent', 'failed'].map(count))
  return { queued, sending, sent, failed }
}

async function refreshCampaign(campaignId) {
  const c = await countByStatus(campaignId)
  const done = c.queued + c.sending === 0
  const status = !done ? 'sending' : c.failed === 0 ? 'sent' : c.sent === 0 ? 'failed' : 'partial'
  const { data, error } = await supabaseAdmin
    .from('email_campaigns')
    .update({ sent: c.sent, failed: c.failed, status, completed_at: done ? new Date().toISOString() : null })
    .eq('id', campaignId)
    .select()
    .single()
  if (error) throw error
  return { ...data, remaining: c.queued + c.sending }
}

/** Send the next batch. The console calls this repeatedly until `remaining` is 0. */
router.post('/campaigns/:id/process', async (req, res) => {
  try {
    requireSmtp()
    const campaignId = Number(req.params.id)
    const { data: campaign, error } = await supabaseAdmin
      .from('email_campaigns').select('*').eq('id', campaignId).maybeSingle()
    if (error) throw error
    if (!campaign) throw new HttpError(404, 'That send no longer exists.')

    const { data: next, error: nextError } = await supabaseAdmin
      .from('email_deliveries').select('id')
      .eq('campaign_id', campaignId).eq('status', 'queued').order('id').limit(BATCH_SIZE)
    if (nextError) throw nextError

    if (next.length) {
      // Claiming flips queued → sending; a row another tab already claimed
      // is no longer queued and drops out, so nobody gets the email twice.
      const { data: claimed, error: claimError } = await supabaseAdmin
        .from('email_deliveries').update({ status: 'sending' })
        .in('id', next.map(r => r.id)).eq('status', 'queued')
        .select('id, email, name, member_id')
      if (claimError) throw claimError

      const memberIds = claimed.map(d => d.member_id).filter(Boolean)
      const codes = {}
      if (memberIds.length) {
        const { data: rows } = await supabaseAdmin.from('members').select('id, member_code').in('id', memberIds)
        for (const r of rows || []) codes[r.id] = r.member_code
      }

      const deliver = async d => {
        try {
          const { subject, html } = renderEmail(campaign.template, {
            ...campaign.variables,
            ...memberVariables({ full_name: d.name, member_code: codes[d.member_id] }),
          }, { language: campaign.language })
          await sendEmail({ to: d.email, subject, html })
          await supabaseAdmin.from('email_deliveries')
            .update({ status: 'sent', error: null, sent_at: new Date().toISOString() }).eq('id', d.id)
        } catch (err) {
          await supabaseAdmin.from('email_deliveries')
            .update({ status: 'failed', error: String(err?.message || err).slice(0, 500) }).eq('id', d.id)
        }
      }
      for (let i = 0; i < claimed.length; i += CONCURRENCY) {
        await Promise.all(claimed.slice(i, i + CONCURRENCY).map(deliver))
      }
    }

    res.json(await refreshCampaign(campaignId))
  } catch (err) {
    fail(res, err, 'The batch was not sent.')
  }
})

/**
 * Put failed deliveries back in the queue. Rows stuck in "sending" (the
 * browser closed mid-batch) are re-queued too.
 */
router.post('/campaigns/:id/retry', async (req, res) => {
  try {
    const campaignId = Number(req.params.id)
    const { error } = await supabaseAdmin
      .from('email_deliveries').update({ status: 'queued', error: null })
      .eq('campaign_id', campaignId).in('status', ['failed', 'sending'])
    if (error) throw error
    res.json(await refreshCampaign(campaignId))
  } catch (err) {
    fail(res, err, 'The failed emails were not re-queued.')
  }
})

export default router
