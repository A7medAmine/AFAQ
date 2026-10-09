import { createHash, randomUUID } from 'node:crypto'
import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { supabaseAdmin } from '../db/client.js'

const router = Router()

const SLUG = /^[A-Za-z0-9_-]{4,64}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const COOKIE = 'afaq_voter'
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60 * 1000
const TEXT_MAX = 2000
const SOURCE = /^[a-z0-9_-]{1,32}$/i

// Keys the device cookie and IP into hashes, so the table never holds a raw
// address and a leaked cookie value can't be matched to other polls.
const SECRET = process.env.POLL_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'afaq-polls'
const hash = (...parts) => createHash('sha256').update([SECRET, ...parts].join('|')).digest('hex')

/**
 * Votes per IP. Generous on purpose: a room full of people at an event
 * often shares one Wi-Fi address. The device cookie does the real
 * one-vote-each work; this only slows a script down.
 */
const voteLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many votes from this network. Wait a few minutes and try again.' },
})

// Opening the poll page. These routes skip the site-wide API limit (100 per
// 15 minutes), which one classroom scanning a QR code would use up.
const readLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this network. Wait a few minutes and try again.' },
})

function readCookie(req, name) {
  const header = req.headers.cookie || ''
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return decodeURIComponent(rest.join('='))
  }
  return null
}

/** The visitor's device id, issued on first sight and kept for a year. */
function deviceId(req, res) {
  const existing = readCookie(req, COOKIE)
  if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing
  const id = randomUUID()
  res.cookie(COOKIE, id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure,
    maxAge: COOKIE_MAX_AGE,
    path: '/api/polls',
  })
  return id
}

/** Where the poll stands right now, with the schedule and cap applied. */
export function pollState(poll, responseCount = 0) {
  if (poll.status === 'draft') return 'draft'
  const now = Date.now()
  if (poll.status === 'closed') return 'closed'
  if (poll.closes_at && new Date(poll.closes_at).getTime() <= now) return 'closed'
  if (poll.opens_at && new Date(poll.opens_at).getTime() > now) return 'scheduled'
  if (poll.max_responses && responseCount >= poll.max_responses) return 'full'
  return 'open'
}

async function loadPoll(slug) {
  if (!SLUG.test(slug || '')) return { poll: null }
  const { data: poll, error } = await supabaseAdmin
    .from('polls')
    .select('id, slug, title, description, language, audience, status, opens_at, closes_at, results_visibility, collect_identity, max_responses, thank_you_message')
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw error
  if (!poll || poll.status === 'draft') return { poll: null }

  const [{ data: questions, error: qError }, { count, error: cError }] = await Promise.all([
    supabaseAdmin.from('poll_questions')
      .select('id, position, type, prompt, help, required, min_choices, max_choices, scale_max, options:poll_options(id, position, label)')
      .eq('poll_id', poll.id)
      .order('position'),
    supabaseAdmin.from('poll_responses').select('id', { count: 'exact', head: true }).eq('poll_id', poll.id),
  ])
  if (qError) throw qError
  if (cError) throw cError
  for (const q of questions) q.options = (q.options || []).sort((a, b) => a.position - b.position)
  return { poll, questions, responseCount: count || 0 }
}

/** Every row of a query, past PostgREST's 1000-row page. */
async function fetchAll(build) {
  const rows = []
  const size = 1000
  for (let from = 0; ; from += size) {
    const { data, error } = await build().range(from, from + size - 1)
    if (error) throw error
    rows.push(...data)
    if (data.length < size) return rows
  }
}

/**
 * Totals for the public results view: option counts and rating averages.
 * Free-text answers are left out — they can carry names and contact details
 * people only meant the club to see.
 */
export async function tallyResults(poll, questions, responseCount) {
  const answers = await fetchAll(() =>
    supabaseAdmin.from('poll_answers').select('response_id, question_id, option_id, number_value').eq('poll_id', poll.id).order('id')
  )
  const byQuestion = new Map(questions.map(q => [q.id, []]))
  for (const a of answers) byQuestion.get(a.question_id)?.push(a)

  return {
    total: responseCount,
    questions: questions.filter(q => q.type !== 'text').map(q => {
      const rows = byQuestion.get(q.id) || []
      if (q.type === 'rating') {
        const values = rows.map(r => r.number_value).filter(v => Number.isInteger(v))
        const scale = q.scale_max || 5
        const counts = Array.from({ length: scale }, (_, i) => values.filter(v => v === i + 1).length)
        const average = values.length ? values.reduce((s, v) => s + v, 0) / values.length : null
        return { id: q.id, type: q.type, answered: values.length, average, counts }
      }
      return {
        id: q.id,
        type: q.type,
        // People who answered, not picks: a multiple-choice answer is a row per pick.
        answered: new Set(rows.map(r => r.response_id)).size,
        options: q.options.map(o => ({ id: o.id, count: rows.filter(r => r.option_id === o.id).length })),
      }
    }),
  }
}

function canSeeResults(poll, state, voted) {
  if (poll.results_visibility === 'hidden') return false
  if (poll.results_visibility === 'after_close') return state === 'closed' || state === 'full'
  return voted || state === 'closed' || state === 'full'
}

const publicPoll = (poll, state) => ({
  slug: poll.slug,
  title: poll.title,
  description: poll.description,
  language: poll.language,
  audience: poll.audience,
  collect_identity: poll.collect_identity,
  results_visibility: poll.results_visibility,
  opens_at: poll.opens_at,
  closes_at: poll.closes_at,
  thank_you_message: poll.thank_you_message,
  state,
})

const publicQuestions = questions => questions.map(q => ({
  id: q.id,
  type: q.type,
  prompt: q.prompt,
  help: q.help,
  required: q.required,
  min_choices: q.min_choices,
  max_choices: q.max_choices,
  scale_max: q.scale_max,
  options: q.options.map(o => ({ id: o.id, label: o.label })),
}))

async function hasVoted(pollId, voterKey) {
  const { data } = await supabaseAdmin.from('poll_responses').select('id').eq('poll_id', pollId).eq('voter_key', voterKey).maybeSingle()
  return !!data
}

/** The poll as anyone with the link sees it; drafts don't exist out here. */
router.get('/p/:slug', readLimiter, async (req, res) => {
  res.set('Cache-Control', 'no-store')
  try {
    const { poll, questions, responseCount } = await loadPoll(req.params.slug)
    if (!poll) return res.status(404).json({ error: 'This poll does not exist or is no longer shared.' })
    const state = pollState(poll, responseCount)
    const device = deviceId(req, res)
    // Members-only polls key on the member, which we only learn when they vote.
    const voted = poll.audience === 'public' ? await hasVoted(poll.id, hash('device', poll.id, device)) : false
    const results = canSeeResults(poll, state, voted) ? await tallyResults(poll, questions, responseCount) : null
    res.json({ poll: publicPoll(poll, state), questions: publicQuestions(questions), voted, results })
  } catch (err) {
    console.error('Public poll:', err)
    res.status(500).json({ error: 'The poll could not be loaded.' })
  }
})

/**
 * Check one person's answers against the questions. Returns the rows to
 * store, or a message naming the first problem.
 */
export function validateAnswers(questions, input) {
  const answers = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  const rows = []
  for (const q of questions) {
    const value = answers[q.id]
    const empty = value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)
    if (empty) {
      if (q.required) return { error: `Please answer: ${q.prompt}`, questionId: q.id }
      continue
    }
    const optionIds = new Set(q.options.map(o => o.id))
    if (q.type === 'single') {
      const id = Number(value)
      if (!optionIds.has(id)) return { error: `Pick one of the choices for: ${q.prompt}`, questionId: q.id }
      rows.push({ question_id: q.id, option_id: id })
    } else if (q.type === 'multiple') {
      if (!Array.isArray(value)) return { error: `Pick from the choices for: ${q.prompt}`, questionId: q.id }
      const ids = [...new Set(value.map(Number))]
      if (!ids.every(id => optionIds.has(id))) return { error: `Pick from the choices for: ${q.prompt}`, questionId: q.id }
      if (q.min_choices && ids.length < q.min_choices) return { error: `Pick at least ${q.min_choices} for: ${q.prompt}`, questionId: q.id }
      if (q.max_choices && ids.length > q.max_choices) return { error: `Pick at most ${q.max_choices} for: ${q.prompt}`, questionId: q.id }
      for (const id of ids) rows.push({ question_id: q.id, option_id: id })
    } else if (q.type === 'rating') {
      const n = Number(value)
      const scale = q.scale_max || 5
      if (!Number.isInteger(n) || n < 1 || n > scale) return { error: `Give a rating from 1 to ${scale} for: ${q.prompt}`, questionId: q.id }
      rows.push({ question_id: q.id, number_value: n })
    } else if (q.type === 'text') {
      if (typeof value !== 'string') return { error: `Write an answer for: ${q.prompt}`, questionId: q.id }
      const text = value.trim().slice(0, TEXT_MAX)
      if (!text) {
        if (q.required) return { error: `Please answer: ${q.prompt}`, questionId: q.id }
        continue
      }
      rows.push({ question_id: q.id, text_value: text })
    }
  }
  return { rows }
}

const VOTE_ERRORS = {
  poll_closed: [409, 'This poll is closed.'],
  poll_full: [409, 'This poll has all the answers it was taking.'],
  poll_not_found: [404, 'This poll does not exist or is no longer shared.'],
}

router.post('/p/:slug/vote', voteLimiter, async (req, res) => {
  res.set('Cache-Control', 'no-store')
  const body = req.body || {}
  try {
    const { poll, questions, responseCount } = await loadPoll(req.params.slug)
    if (!poll) return res.status(404).json({ error: VOTE_ERRORS.poll_not_found[1] })

    // Bots fill every field they find; people never see this one.
    if (typeof body.website === 'string' && body.website.trim()) return res.json({ ok: true, voted: true, results: null })

    const state = pollState(poll, responseCount)
    if (state === 'scheduled') return res.status(409).json({ error: 'This poll has not opened yet.' })
    if (state === 'closed') return res.status(409).json({ error: VOTE_ERRORS.poll_closed[1] })
    if (state === 'full') return res.status(409).json({ error: VOTE_ERRORS.poll_full[1] })

    const checked = validateAnswers(questions, body.answers)
    if (checked.error) return res.status(400).json({ error: checked.error, questionId: checked.questionId })
    if (!checked.rows.length) return res.status(400).json({ error: 'Answer at least one question.' })

    let name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : ''
    let email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 200) : ''
    let memberId = null
    let voterKey

    if (poll.audience === 'members') {
      const code = typeof body.member_code === 'string' ? body.member_code.trim() : ''
      if (!code || !email) return res.status(400).json({ error: 'Enter your member code and the email the club has for you.', field: 'member' })
      const { data: member, error } = await supabaseAdmin
        .from('members').select('id, full_name, email, status').eq('member_code', code).maybeSingle()
      if (error) throw error
      // The same answer whether the code or the email is wrong, so the form
      // can't be used to find out which codes exist.
      if (!member || member.email?.trim().toLowerCase() !== email || member.status !== 'active') {
        return res.status(403).json({ error: 'That member code and email do not match an active member.', field: 'member' })
      }
      memberId = member.id
      name = member.full_name
      email = member.email
      voterKey = `member:${member.id}`
    } else {
      if (poll.collect_identity === 'none') { name = ''; email = '' }
      if (poll.collect_identity === 'required' && (!name || !email)) {
        return res.status(400).json({ error: 'Enter your name and email.', field: 'identity' })
      }
      if (email && !EMAIL.test(email)) return res.status(400).json({ error: 'That email address does not look right.', field: 'identity' })
      voterKey = hash('device', poll.id, deviceId(req, res))
    }

    const source = typeof body.source === 'string' && SOURCE.test(body.source) ? body.source.toLowerCase() : null
    const { error } = await supabaseAdmin.rpc('poll_submit_response', {
      p_poll_id: poll.id,
      p_voter_key: voterKey,
      p_member_id: memberId,
      p_name: name || null,
      p_email: email || null,
      p_ip_hash: hash('ip', req.ip || ''),
      p_source: source,
      p_answers: checked.rows,
    })
    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'You already answered this poll.', voted: true })
      const known = VOTE_ERRORS[error.message]
      if (known) return res.status(known[0]).json({ error: known[1] })
      throw error
    }

    const nextState = pollState(poll, responseCount + 1)
    const results = canSeeResults(poll, nextState, true) ? await tallyResults(poll, questions, responseCount + 1) : null
    res.json({ ok: true, voted: true, results })
  } catch (err) {
    console.error('Poll vote:', err)
    res.status(500).json({ error: 'Your answer could not be saved. Try again.' })
  }
})

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

/**
 * index.html with the poll's title and description in the link-preview tags,
 * so a link pasted into WhatsApp or Facebook shows the question, not just the
 * club name. Falls back to the page untouched.
 */
export async function pollPreviewHtml(html, slug, url) {
  if (!SLUG.test(slug || '')) return html
  const { data: poll } = await supabaseAdmin.from('polls').select('title, description, status').eq('slug', slug).maybeSingle()
  if (!poll || poll.status === 'draft') return html
  const title = escapeHtml(`${poll.title} · AFAQ poll`)
  const description = escapeHtml((poll.description || 'Take part in this poll from the AFAQ Scientific Club.').slice(0, 200))
  return html
    .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
    .replace(/(<meta property="og:title" content=")[^"]*/, `$1${title}`)
    .replace(/(<meta property="og:description" content=")[^"]*/, `$1${description}`)
    .replace(/(<meta name="description" content=")[^"]*/, `$1${description}`)
    .replace(/(<meta property="og:url" content=")[^"]*/, `$1${escapeHtml(url)}`)
}

export default router
