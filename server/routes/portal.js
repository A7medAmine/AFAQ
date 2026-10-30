import crypto from 'node:crypto'
import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { supabaseAdmin } from '../db/client.js'
import { requireAuth, requirePermission } from '../middleware/auth.js'
import { sendEmail } from '../services/mailer.js'
import { clubEmail, escapeHtml } from '../services/membership.js'

/**
 * Member portal accounts (/portal). A member signs in with their club email
 * and a password they set through an emailed link. The link is built from a
 * Supabase recovery token but points at our own /portal/set-password page,
 * so no session ever lands in the URL hash where the admin client would
 * pick it up.
 */
const router = Router()

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// A batch has to finish inside one serverless invocation, so keep it small.
const BATCH_SIZE = 20
const CONCURRENCY = 4

const claimLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Try again in a few minutes.' },
})

const siteUrl = req => process.env.VITE_APP_URL || req.headers.origin || 'https://afaq.club'

const canSignIn = member => (member.status || 'active') !== 'suspended'

/** The auth account for this member, created and linked on first use. */
async function ensurePortalUser(member) {
  if (member.user_id) return member.user_id
  const { data: existing, error: lookupError } = await supabaseAdmin.rpc('auth_user_id_by_email', { p_email: member.email })
  if (lookupError) throw lookupError
  let userId = existing
  if (!userId) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: member.email.trim().toLowerCase(),
      email_confirm: true,
      user_metadata: { full_name: member.full_name },
    })
    if (error) throw error
    userId = data.user.id
  }
  const { error } = await supabaseAdmin.from('members').update({ user_id: userId }).eq('id', member.id)
  if (error) throw error
  return userId
}

/** Emails the member a link to set (or reset) their portal password. */
async function sendAccessLink(member, req, { invited }) {
  await ensurePortalUser(member)
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({ type: 'recovery', email: member.email.trim().toLowerCase() })
  if (error) throw error
  const url = `${siteUrl(req)}/portal/set-password?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=recovery`
  const first = escapeHtml((member.full_name || '').split(/\s+/)[0] || 'there')
  await sendEmail({
    to: member.email,
    subject: invited ? 'Your AFAQ member account' : 'Set your AFAQ member password',
    html: clubEmail(
      `Hello ${first},`,
      invited
        ? [
            'You now have a member account on the AFAQ website. Sign in to see your points, your department, upcoming events and the club’s notices for members.',
            'Use the button below to choose your password. The link works once and expires soon; you can always ask for a new one from the sign-in page.',
          ]
        : [
            'Someone (hopefully you) asked to set the password of your AFAQ member account.',
            'Use the button below to choose a new one. If this was not you, ignore this email; your account stays as it is.',
          ],
      { label: 'Set my password', url }
    ),
  })
  await supabaseAdmin.from('members').update({ portal_invited_at: new Date().toISOString() }).eq('id', member.id)
}

/**
 * First sign-in or forgotten password, from the portal login page. Always
 * answers the same way so the form does not reveal who is a member.
 */
router.post('/claim', claimLimiter, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  if (!EMAIL.test(email) || email.length > 200) return res.status(400).json({ error: 'Enter a valid email address.' })
  try {
    const { data: member } = await supabaseAdmin
      .from('members').select('id, full_name, email, status, user_id')
      .ilike('email', email).limit(1).maybeSingle()
    if (member && canSignIn(member)) await sendAccessLink(member, req, { invited: false })
  } catch (err) {
    console.error('Portal claim error:', err.message)
  }
  res.json({ ok: true })
})

/** Console: send portal invitations to the chosen members. */
router.post('/invite', requireAuth, requirePermission('membership.manage', 'super_admin', 'event_manager'), async (req, res) => {
  const ids = [...new Set((Array.isArray(req.body?.member_ids) ? req.body.member_ids : []).map(Number).filter(Number.isInteger))]
  if (!ids.length) return res.status(400).json({ error: 'Choose at least one member.' })
  if (ids.length > BATCH_SIZE) return res.status(400).json({ error: `Send at most ${BATCH_SIZE} invitations at a time.` })

  const { data: members, error } = await supabaseAdmin
    .from('members').select('id, full_name, email, status, user_id').in('id', ids)
  if (error) return res.status(500).json({ error: 'The members could not be loaded.' })

  const results = []
  const queue = [...members]
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const member = queue.shift()
      if (!canSignIn(member)) { results.push({ id: member.id, ok: false, error: 'Suspended members cannot sign in.' }); continue }
      if (!EMAIL.test(member.email || '')) { results.push({ id: member.id, ok: false, error: 'No valid email address.' }); continue }
      try {
        await sendAccessLink(member, req, { invited: true })
        results.push({ id: member.id, ok: true })
      } catch (err) {
        console.error('Portal invite error:', member.id, err.message)
        results.push({ id: member.id, ok: false, error: 'The invitation could not be sent.' })
      }
    }
  }))
  res.json({ sent: results.filter(r => r.ok).length, results })
})

/** Console: remove a member's sign-in link (their auth account stays for admins who are also members). */
router.post('/revoke', requireAuth, requirePermission('membership.manage', 'super_admin', 'event_manager'), async (req, res) => {
  const id = Number(req.body?.member_id)
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Choose a member.' })
  const { data: member } = await supabaseAdmin.from('members').select('id, user_id').eq('id', id).maybeSingle()
  if (!member) return res.status(404).json({ error: 'That member no longer exists.' })
  if (member.user_id) {
    const { data: admin } = await supabaseAdmin.from('admin_users').select('id').eq('user_id', member.user_id).maybeSingle()
    // Sign them out everywhere; an admin keeps their console account.
    if (!admin) await supabaseAdmin.auth.admin.deleteUser(member.user_id)
  }
  const { error } = await supabaseAdmin.from('members').update({ user_id: null, portal_invited_at: null }).eq('id', id)
  if (error) return res.status(500).json({ error: 'Access was not removed.' })
  res.json({ ok: true })
})

// No 0/O or 1/l/I, so a password read off a screen or paper is typed right.
const PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
const randomPassword = () => {
  const bytes = crypto.randomBytes(12)
  const chars = Array.from(bytes, b => PASSWORD_CHARS[b % PASSWORD_CHARS.length]).join('')
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8)}`
}
const passwordProblem = pw => (typeof pw !== 'string' || pw.length < 8 ? 'Use at least 8 characters.'
  : pw.length > 72 ? 'Use at most 72 characters.' : null)

/**
 * Console: give a member a temporary password, for members whose email does
 * not work or who sign in at a club desk. It is either emailed to them or
 * returned once for the admin to hand over; either way the portal makes the
 * member choose their own password at their next sign-in.
 */
router.post('/temp-password', requireAuth, requirePermission('membership.manage', 'super_admin', 'event_manager'), async (req, res) => {
  const id = Number(req.body?.member_id)
  const sendByEmail = req.body?.send_email === true
  const password = req.body?.password ? String(req.body.password) : randomPassword()
  const problem = passwordProblem(password)
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Choose a member.' })
  if (problem) return res.status(400).json({ error: problem })

  try {
    const { data: member } = await supabaseAdmin
      .from('members').select('id, full_name, email, status, user_id').eq('id', id).maybeSingle()
    if (!member) return res.status(404).json({ error: 'That member no longer exists.' })
    if (!canSignIn(member)) return res.status(409).json({ error: 'Suspended members cannot sign in.' })
    if (!EMAIL.test(member.email || '')) return res.status(400).json({ error: 'This member has no valid email address to sign in with.' })

    const userId = await ensurePortalUser(member)
    // The same account opens the console for an admin who is also a member;
    // a temporary password would replace their console password too.
    const { data: admin } = await supabaseAdmin.from('admin_users').select('id').eq('user_id', userId).maybeSingle()
    if (admin) return res.status(409).json({ error: 'This member is also an admin. Send them a password link instead.' })

    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password })
    if (error) throw error
    await supabaseAdmin.from('members')
      .update({ portal_must_change_password: true, portal_invited_at: new Date().toISOString() })
      .eq('id', member.id)

    if (!sendByEmail) return res.json({ ok: true, password })

    const first = escapeHtml((member.full_name || '').split(/\s+/)[0] || 'there')
    await sendEmail({
      to: member.email,
      subject: 'Your AFAQ member account',
      html: clubEmail(
        `Hello ${first},`,
        [
          'You now have a member account on the AFAQ website, where you can see your points, your department, upcoming events and notices for members.',
          `Sign in with your email <strong>${escapeHtml(member.email)}</strong> and this temporary password:`,
          `<span style="display: inline-block; font-family: monospace; font-size: 18px; letter-spacing: 1px; background: #e2e8f0; color: #0f172a; padding: 8px 14px; border-radius: 6px;">${escapeHtml(password)}</span>`,
          'You will be asked to choose your own password right after signing in. Do not share this email.',
        ],
        { label: 'Sign in', url: `${siteUrl(req)}/portal/login` }
      ),
    })
    res.json({ ok: true, emailed: true })
  } catch (err) {
    console.error('Temporary password error:', id, err.message)
    res.status(500).json({ error: 'The temporary password was not set.' })
  }
})

/** Member: choose a new password (after a temporary one, a reset link, or from the profile). */
router.post('/password', claimLimiter, requireAuth, async (req, res) => {
  const password = req.body?.password
  const problem = passwordProblem(password)
  if (problem) return res.status(400).json({ error: problem })
  const { data: member } = await supabaseAdmin
    .from('members').select('id, status').eq('user_id', req.user.id).maybeSingle()
  if (!member || !canSignIn(member)) return res.status(403).json({ error: 'This account is not linked to a club member.' })

  const { error } = await supabaseAdmin.auth.admin.updateUserById(req.user.id, { password })
  if (error) {
    const same = /different from the old/i.test(error.message)
    if (!same) console.error('Portal password error:', member.id, error.message)
    return res.status(same ? 400 : 500).json({ error: same ? 'Choose a password different from the current one.' : 'The password was not saved.', code: same ? 'same' : undefined })
  }
  await supabaseAdmin.from('members').update({ portal_must_change_password: false }).eq('id', member.id)
  res.json({ ok: true })
})

/** The members a notice reaches, by id, for emailing it. */
async function noticeAudience(noticeId) {
  const { data: targets, error } = await supabaseAdmin
    .from('member_notice_targets').select('department_id, group_id, member_id').eq('notice_id', noticeId)
  if (error) throw error
  let query = supabaseAdmin.from('members')
    .select('id, full_name, email').eq('status', 'active').eq('email_opt_out', false).order('id')
  if (targets.length) {
    const ids = new Set(targets.filter(t => t.member_id).map(t => t.member_id))
    const departments = targets.filter(t => t.department_id).map(t => t.department_id)
    const groups = targets.filter(t => t.group_id).map(t => t.group_id)
    if (departments.length) {
      const { data } = await supabaseAdmin.from('member_departments').select('member_id').in('department_id', departments)
      data?.forEach(r => ids.add(r.member_id))
    }
    if (groups.length) {
      const { data } = await supabaseAdmin.from('member_group_members').select('member_id').in('group_id', groups)
      data?.forEach(r => ids.add(r.member_id))
    }
    if (!ids.size) return []
    query = query.in('id', [...ids])
  }
  const { data, error: membersError } = await query
  if (membersError) throw membersError
  return data.filter(m => EMAIL.test(m.email || ''))
}

/**
 * Console: email a notice to its audience, one batch per request. The
 * console calls again with `after` (the last member id) until `next` is null.
 */
router.post('/notices/:id/email', requireAuth, requirePermission('announcements.manage', 'super_admin', 'event_manager', 'media_manager'), async (req, res) => {
  const id = Number(req.params.id)
  const after = Number(req.body?.after) || 0
  try {
    const { data: notice } = await supabaseAdmin.from('member_notices').select('*').eq('id', id).maybeSingle()
    if (!notice) return res.status(404).json({ error: 'That notice no longer exists.' })
    const audience = await noticeAudience(id)
    const batch = audience.filter(m => m.id > after).slice(0, BATCH_SIZE)
    const paragraphs = escapeHtml(notice.body).split(/\n{2,}/).map(p => p.replace(/\n/g, '<br/>'))
    let sent = 0
    const queue = [...batch]
    await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length) {
        const member = queue.shift()
        try {
          await sendEmail({
            to: member.email,
            subject: notice.title,
            html: clubEmail(escapeHtml(notice.title), paragraphs, { label: 'Open the member portal', url: `${siteUrl(req)}/portal/notices` }),
          })
          sent++
        } catch (err) {
          console.error('Notice email error:', member.id, err.message)
        }
      }
    }))
    const last = batch[batch.length - 1]
    const next = last && audience.some(m => m.id > last.id) ? last.id : null
    if (next === null) await supabaseAdmin.from('member_notices').update({ emailed_at: new Date().toISOString() }).eq('id', id)
    res.json({ sent, total: audience.length, next })
  } catch (err) {
    console.error('Notice email error:', err.message)
    res.status(500).json({ error: 'The notice could not be emailed.' })
  }
})

export default router
