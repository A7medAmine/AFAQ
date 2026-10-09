import { Router } from 'express'
import { supabaseAdmin } from '../db/client.js'
import { requireAuth } from '../middleware/auth.js'
import { sendEmail } from '../services/mailer.js'
import {
  approveApplication, clubEmail, escapeHtml, getIntake, HttpError, sendApplicationReceived,
} from '../services/membership.js'
import {
  isStale, loadContext, logEvent, pickReviewer, pickTeam, placeApplication, sweep, sweepThrottled,
} from '../services/reviewRouting.js'

/**
 * Review queues. Any active admin who sits on a review team works here; admins
 * who manage membership (event managers, super admins) see every queue, the
 * load board, and can reassign. All writes go through the service role, so
 * the rules about who may touch what live in `canAct` below, not in RLS.
 */

// --- Public: interests offered on the join form ---

export const publicReviewRoutes = Router()

publicReviewRoutes.get('/', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('interests').select('key, label_en, label_ar, label_fr')
    .eq('is_active', true).order('sort_order').order('id')
  if (error) {
    console.error('Interests read error:', error.message)
    return res.status(500).json({ error: 'Could not load interests.' })
  }
  res.set('Cache-Control', 'public, max-age=300')
  res.json(data)
})

// --- Admin ---

const router = Router()

const MANAGER_ROLES = ['super_admin', 'event_manager']

const fail = (res, err, fallback) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message })
  console.error(fallback, err)
  return res.status(500).json({ error: fallback })
}

/** Resolve the caller: their admin row, their teams, whether they manage membership. */
router.use(requireAuth, async (req, res, next) => {
  try {
    const { data: admin, error } = await supabaseAdmin
      .from('admin_users').select('*, role:admin_roles(name)').eq('user_id', req.user.id).maybeSingle()
    if (error) throw error
    if (!admin?.is_active) return res.status(403).json({ error: 'Forbidden' })
    const { data: teams, error: teamErr } = await supabaseAdmin
      .from('team_reviewers').select('team_id').eq('admin_user_id', admin.id)
    if (teamErr) throw teamErr
    req.me = {
      id: admin.id,
      userId: admin.user_id,
      name: admin.full_name || admin.email,
      isManager: MANAGER_ROLES.includes(admin.role?.name),
      teamIds: teams.map(t => t.team_id),
      available: admin.review_available,
      capacity: admin.review_capacity,
    }
    next()
  } catch (err) {
    fail(res, err, 'Could not check your access.')
  }
})

const requireManager = (req, res, next) =>
  req.me.isManager ? next() : res.status(403).json({ error: 'Only membership managers can do this.' })

/** Can see: managers everything; reviewers their own, their teams', and the pool. */
function canSee(me, app) {
  if (me.isManager || app.reviewer_id === me.id) return true
  if (!me.teamIds.length) return false
  return app.team_id == null || me.teamIds.includes(app.team_id)
}

/** Can act: managers anything; reviewers their own, or an unassigned one in their reach. */
function canAct(me, app) {
  if (me.isManager || app.reviewer_id === me.id) return true
  return app.reviewer_id == null && canSee(me, app)
}

async function loadApplication(req, id) {
  const { data: app, error } = await supabaseAdmin
    .from('membership_applications').select('*').eq('id', Number(id)).maybeSingle()
  if (error) throw error
  if (!app || !canSee(req.me, app)) throw new HttpError(404, 'Application not found.')
  return app
}

function requireOpen(app) {
  if (app.status !== 'pending') throw new HttpError(409, 'This application has already been decided.')
}

function requireAct(req, app) {
  if (!canAct(req.me, app)) throw new HttpError(403, 'Another reviewer has this application. Ask a membership manager to reassign it.')
}

async function reviewerDirectory() {
  const { data, error } = await supabaseAdmin
    .from('admin_users').select('id, full_name, email, is_active, review_available, review_capacity')
    .eq('is_active', true).order('full_name')
  if (error) throw error
  return data
}

// --- Queue ---

router.get('/queue', async (req, res) => {
  try {
    await sweepThrottled()
    const [open, decided, teams, links, reviewers, settings] = await Promise.all([
      supabaseAdmin.from('membership_applications').select('*').eq('status', 'pending').order('created_at'),
      supabaseAdmin.from('membership_applications').select('*').neq('status', 'pending')
        .not('decided_at', 'is', null).order('decided_at', { ascending: false }).limit(200),
      supabaseAdmin.from('review_teams').select('*').order('sort_order').order('id'),
      supabaseAdmin.from('team_reviewers').select('team_id, admin_user_id'),
      reviewerDirectory().then(data => ({ data }), error => ({ error })),
      supabaseAdmin.from('review_settings').select('stale_days, applications_open, applications_closed_note').eq('id', 1).maybeSingle(),
    ])
    for (const r of [open, decided, teams, links, reviewers, settings]) if (r.error) throw r.error

    const staleMs = (settings.data?.stale_days ?? 5) * 86400000
    const me = req.me
    const visibleOpen = open.data.filter(a => canSee(me, a))
      .map(a => ({ ...a, stale: isStale(a, staleMs), can_act: canAct(me, a) }))
    // Decided list: managers see recent decisions; reviewers the ones they handled.
    const visibleDecided = decided.data.filter(a => me.isManager || a.decided_by === me.userId || a.reviewer_id === me.id)

    res.json({
      me: { id: me.id, isManager: me.isManager, teamIds: me.teamIds, available: me.available, capacity: me.capacity },
      staleDays: settings.data?.stale_days ?? 5,
      intake: { open: settings.data?.applications_open ?? true, note: settings.data?.applications_closed_note || null },
      teams: teams.data.map(t => ({
        ...t,
        reviewer_ids: links.data.filter(l => l.team_id === t.id).map(l => l.admin_user_id),
      })),
      reviewers: reviewers.data,
      open: visibleOpen,
      decided: visibleDecided,
    })
  } catch (err) {
    fail(res, err, 'Could not load the review queue.')
  }
})

router.get('/applications/:id/events', async (req, res) => {
  try {
    await loadApplication(req, req.params.id)
    const { data, error } = await supabaseAdmin
      .from('application_events').select('*').eq('application_id', Number(req.params.id)).order('created_at')
    if (error) throw error
    res.json(data)
  } catch (err) {
    fail(res, err, 'Could not load the history.')
  }
})

/** Send the "application received" email again, e.g. when the first one never left. */
router.post('/applications/:id/resend-confirmation', async (req, res) => {
  try {
    const app = await loadApplication(req, req.params.id)
    requireOpen(app)
    await sendApplicationReceived(app)
    res.json({ ok: true })
  } catch (err) {
    fail(res, err, 'The confirmation email was not sent.')
  }
})

// --- Intake (managers) ---

/** Open or close the join form. Applications already in the queue are untouched. */
router.patch('/intake', requireManager, async (req, res) => {
  try {
    const b = req.body || {}
    if (typeof b.open !== 'boolean') throw new HttpError(400, 'Say whether applications are open.')
    const note = String(b.note || '').trim().slice(0, 500) || null
    const { error } = await supabaseAdmin.from('review_settings').upsert({
      id: 1, applications_open: b.open, applications_closed_note: b.open ? null : note,
      updated_at: new Date().toISOString(),
    })
    if (error) throw error
    res.json({ ok: true, intake: await getIntake() })
  } catch (err) {
    fail(res, err, 'Could not change whether applications are open.')
  }
})

// --- Moving applications ---

router.post('/applications/:id/claim', async (req, res) => {
  try {
    const app = await loadApplication(req, req.params.id)
    requireOpen(app)
    if (app.reviewer_id === req.me.id) return res.json({ ok: true })
    requireAct(req, app)
    const ctx = await loadContext()
    await placeApplication(ctx.open.find(a => a.id === app.id) || app, ctx, {
      teamId: app.team_id, reviewerId: req.me.id, kind: 'claimed', actorId: req.user.id,
    })
    res.json({ ok: true })
  } catch (err) {
    fail(res, err, 'Could not claim the application.')
  }
})

/** Hand it to the next free reviewer in the team, or back to the pool. */
router.post('/applications/:id/release', async (req, res) => {
  try {
    const app = await loadApplication(req, req.params.id)
    requireOpen(app)
    requireAct(req, app)
    const ctx = await loadContext()
    const tracked = ctx.open.find(a => a.id === app.id) || app
    const reviewerId = app.team_id ? pickReviewer(app.team_id, ctx, [app.reviewer_id].filter(Boolean)) : null
    await placeApplication(tracked, ctx, {
      teamId: app.team_id, reviewerId, kind: 'released',
      note: String(req.body?.note || '').trim() || null, actorId: req.user.id,
    })
    res.json({ ok: true, reviewerId })
  } catch (err) {
    fail(res, err, 'Could not release the application.')
  }
})

/** "Applied for Tech but is really a designer" — send to another team (or the pool). */
router.post('/applications/:id/transfer', async (req, res) => {
  try {
    const app = await loadApplication(req, req.params.id)
    requireOpen(app)
    requireAct(req, app)
    const teamId = req.body?.teamId == null ? null : Number(req.body.teamId)
    const ctx = await loadContext()
    if (teamId != null && !ctx.teams.some(t => t.id === teamId)) throw new HttpError(400, 'That team no longer exists.')
    if (teamId === app.team_id) throw new HttpError(400, 'It is already with that team.')
    await placeApplication(ctx.open.find(a => a.id === app.id) || app, ctx, {
      teamId, kind: 'transferred', exclude: [req.me.id],
      note: String(req.body?.note || '').trim() || null, actorId: req.user.id,
    })
    res.json({ ok: true })
  } catch (err) {
    fail(res, err, 'Could not transfer the application.')
  }
})

router.post('/applications/:id/assign', requireManager, async (req, res) => {
  try {
    const app = await loadApplication(req, req.params.id)
    requireOpen(app)
    const reviewerId = req.body?.reviewerId == null ? null : Number(req.body.reviewerId)
    if (reviewerId != null) {
      const { data: target } = await supabaseAdmin.from('admin_users').select('id, is_active').eq('id', reviewerId).maybeSingle()
      if (!target?.is_active) throw new HttpError(400, 'That reviewer is not an active admin.')
    }
    const ctx = await loadContext()
    await placeApplication(ctx.open.find(a => a.id === app.id) || app, ctx, {
      teamId: app.team_id, reviewerId, kind: 'reassigned', actorId: req.user.id,
    })
    res.json({ ok: true })
  } catch (err) {
    fail(res, err, 'Could not reassign the application.')
  }
})

// --- Reviewing ---

const ALGIERS = { timeZone: 'Africa/Algiers', dateStyle: 'full', timeStyle: 'short' }

/** Interview time, rating and notes. Optionally emails the interview invitation. */
router.patch('/applications/:id', async (req, res) => {
  try {
    const app = await loadApplication(req, req.params.id)
    requireOpen(app)
    requireAct(req, app)
    const b = req.body || {}
    const patch = { last_activity_at: new Date().toISOString() }

    if ('notes' in b) patch.review_notes = String(b.notes || '').trim() || null
    if ('rating' in b) {
      const rating = b.rating == null || b.rating === '' ? null : Number(b.rating)
      if (rating != null && !(Number.isInteger(rating) && rating >= 1 && rating <= 5)) throw new HttpError(400, 'Rate from 1 to 5.')
      patch.review_rating = rating
    }
    let interviewChanged = false
    if ('interviewAt' in b) {
      const at = b.interviewAt ? new Date(b.interviewAt) : null
      if (at && Number.isNaN(at.getTime())) throw new HttpError(400, 'That interview time is not valid.')
      patch.interview_at = at ? at.toISOString() : null
      const before = app.interview_at ? new Date(app.interview_at).getTime() : null
      interviewChanged = (at ? at.getTime() : null) !== before
    }
    // Working on an unassigned application makes it yours.
    if (!app.reviewer_id) {
      patch.reviewer_id = req.me.id
      patch.assigned_at = patch.last_activity_at
    }
    const reviewerId = patch.reviewer_id ?? app.reviewer_id
    const interviewAt = 'interview_at' in patch ? patch.interview_at : app.interview_at
    patch.stage = interviewAt ? 'interview' : reviewerId ? 'assigned' : 'pool'

    const { error } = await supabaseAdmin.from('membership_applications').update(patch).eq('id', app.id)
    if (error) throw error
    if (!app.reviewer_id) await logEvent(app.id, 'claimed', { fromTeamId: app.team_id, toTeamId: app.team_id, toReviewerId: req.me.id, actorId: req.user.id })

    if (interviewChanged) {
      const when = patch.interview_at ? new Date(patch.interview_at).toLocaleString('en-GB', ALGIERS) : null
      const location = String(b.location || '').trim()
      await logEvent(app.id, 'interview', {
        toReviewerId: reviewerId, actorId: req.user.id,
        note: when ? [when, location].filter(Boolean).join(' · ') : 'Interview cancelled',
      })
      if (when && b.sendInvite) {
        const message = String(b.message || '').trim()
        await sendEmail({
          to: app.email,
          subject: 'Your interview with AFAQ Scientific Club',
          html: clubEmail(`Hello ${escapeHtml(app.full_name)},`, [
            'Thank you for applying to join the club. We would like to meet you for a short interview.',
            `<strong>When:</strong> ${escapeHtml(when)}${location ? `<br/><strong>Where:</strong> ${escapeHtml(location)}` : ''}<br/><strong>With:</strong> ${escapeHtml(req.me.name)}`,
            ...(message ? [escapeHtml(message).replace(/\n/g, '<br/>')] : []),
            'If the time does not suit you, reply to this email and we will find another.',
          ]),
        })
      }
    }
    res.json({ ok: true })
  } catch (err) {
    fail(res, err, 'Could not save the review.')
  }
})

/** Accepting makes them a club member straight away. */
router.post('/applications/:id/decide', async (req, res) => {
  try {
    const app = await loadApplication(req, req.params.id)
    requireOpen(app)
    requireAct(req, app)
    const decision = req.body?.decision
    const note = String(req.body?.note || '').trim() || null
    if (decision === 'approved') {
      const { member } = await approveApplication(app.id, { decidedBy: req.user.id })
      if (!app.reviewer_id) {
        await supabaseAdmin.from('membership_applications').update({ reviewer_id: req.me.id }).eq('id', app.id)
      }
      await logEvent(app.id, 'approved', { toTeamId: app.team_id, toReviewerId: app.reviewer_id ?? req.me.id, note, actorId: req.user.id })
      return res.json({ ok: true, member })
    }
    if (decision === 'rejected') {
      const now = new Date().toISOString()
      const { error } = await supabaseAdmin.from('membership_applications').update({
        status: 'rejected', decided_at: now, decided_by: req.user.id, last_activity_at: now,
        reviewer_id: app.reviewer_id ?? req.me.id,
      }).eq('id', app.id)
      if (error) throw error
      await logEvent(app.id, 'rejected', { toTeamId: app.team_id, toReviewerId: app.reviewer_id ?? req.me.id, note, actorId: req.user.id })
      return res.json({ ok: true })
    }
    throw new HttpError(400, 'Choose accept or reject.')
  } catch (err) {
    fail(res, err, 'Could not record the decision.')
  }
})

// --- Reviewer availability ---

async function setAvailability(adminId, body) {
  const patch = {}
  if ('available' in body) patch.review_available = !!body.available
  if ('capacity' in body) {
    const cap = body.capacity == null || body.capacity === '' ? null : Number(body.capacity)
    if (cap != null && !(Number.isInteger(cap) && cap >= 0 && cap <= 500)) throw new HttpError(400, 'Capacity must be a whole number.')
    patch.review_capacity = cap
  }
  if (!Object.keys(patch).length) throw new HttpError(400, 'Nothing to change.')
  const { error } = await supabaseAdmin.from('admin_users').update(patch).eq('id', adminId)
  if (error) throw error
}

router.patch('/me', async (req, res) => {
  try {
    await setAvailability(req.me.id, req.body || {})
    res.json({ ok: true })
  } catch (err) {
    fail(res, err, 'Could not update your availability.')
  }
})

router.patch('/reviewers/:adminId', requireManager, async (req, res) => {
  try {
    await setAvailability(Number(req.params.adminId), req.body || {})
    res.json({ ok: true })
  } catch (err) {
    fail(res, err, 'Could not update the reviewer.')
  }
})

/**
 * Spread a reviewer's open applications over their teammates — for someone
 * going away for exams. Ones nobody else can take go back to their team's
 * unassigned queue (or the pool).
 */
router.post('/reviewers/:adminId/handoff', async (req, res) => {
  try {
    const adminId = Number(req.params.adminId)
    if (adminId !== req.me.id && !req.me.isManager) throw new HttpError(403, 'You can only hand off your own applications.')
    const ctx = await loadContext()
    let moved = 0
    for (const app of ctx.open.filter(a => a.reviewer_id === adminId)) {
      const reviewerId = app.team_id ? pickReviewer(app.team_id, ctx, [adminId]) : null
      await placeApplication(app, ctx, {
        teamId: app.team_id, reviewerId, kind: 'released', note: 'Handed off', actorId: req.user.id,
      })
      moved += 1
    }
    res.json({ ok: true, moved })
  } catch (err) {
    fail(res, err, 'Could not hand off the applications.')
  }
})

/** Active admins, for picking a team's reviewers (admin_users RLS hides them from non-super admins). */
router.get('/directory', requireManager, async (req, res) => {
  try {
    res.json(await reviewerDirectory())
  } catch (err) {
    fail(res, err, 'Could not load the admins.')
  }
})

// --- Load board (managers) ---

router.get('/load', requireManager, async (req, res) => {
  try {
    const since = new Date(Date.now() - 30 * 86400000).toISOString()
    const [ctx, decided, reviewers] = await Promise.all([
      loadContext(),
      supabaseAdmin.from('membership_applications').select('reviewer_id, team_id, created_at, decided_at')
        .neq('status', 'pending').gte('decided_at', since),
      reviewerDirectory(),
    ])
    if (decided.error) throw decided.error
    const staleMs = ctx.staleDays * 86400000

    const teamIdsOf = id => ctx.teams.filter(t => (ctx.reviewersByTeam.get(t.id) || []).some(r => r.id === id)).map(t => t.id)
    const rows = reviewers.map(r => {
      const open = ctx.open.filter(a => a.reviewer_id === r.id)
      const done = decided.data.filter(a => a.reviewer_id === r.id)
      const days = done.map(a => (new Date(a.decided_at) - new Date(a.created_at)) / 86400000)
      return {
        id: r.id,
        name: r.full_name || r.email,
        email: r.email,
        available: r.review_available,
        capacity: r.review_capacity,
        team_ids: teamIdsOf(r.id),
        open: open.length,
        interviews: open.filter(a => a.stage === 'interview').length,
        stale: open.filter(a => isStale(a, staleMs)).length,
        decided_30d: done.length,
        avg_days: days.length ? Math.round((days.reduce((s, d) => s + d, 0) / days.length) * 10) / 10 : null,
      }
    }).filter(r => r.team_ids.length || r.open || r.decided_30d)

    const teams = ctx.teams.map(t => ({
      id: t.id,
      name: t.name_en,
      color: t.color,
      reviewers: (ctx.reviewersByTeam.get(t.id) || []).length,
      open: ctx.open.filter(a => a.team_id === t.id).length,
      unassigned: ctx.open.filter(a => a.team_id === t.id && !a.reviewer_id).length,
    }))
    const pool = ctx.open.filter(a => a.routed_at && !a.team_id && !a.reviewer_id).length

    res.json({ staleDays: ctx.staleDays, reviewers: rows, teams, pool })
  } catch (err) {
    fail(res, err, 'Could not load the review load.')
  }
})

/** Run the housekeeping now, and optionally re-route the whole general pool. */
router.post('/rebalance', requireManager, async (req, res) => {
  try {
    const ctx = await sweep()
    let rerouted = 0
    if (req.body?.reroutePool) {
      for (const app of ctx.open.filter(a => !a.team_id && !a.reviewer_id)) {
        const teamId = pickTeam(app.interests, ctx)
        if (!teamId) continue
        await placeApplication(app, ctx, { teamId, kind: 'routed', actorId: req.user.id })
        rerouted += 1
      }
    }
    res.json({ ok: true, rerouted })
  } catch (err) {
    fail(res, err, 'Could not rebalance.')
  }
})

export default router
