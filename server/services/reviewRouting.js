import { supabaseAdmin } from '../db/client.js'

/**
 * Membership review routing.
 *
 * An application goes to the team most of its interests point to (ties go to
 * the team with the shorter queue), then to that team's least-loaded
 * reviewer — skipping reviewers marked away or already at their capacity.
 * Nothing matching means the general pool, where any reviewer can claim it.
 *
 * Serverless functions cannot run timers, so the housekeeping (routing
 * leftovers, assigning team queues that had nobody free, reassigning
 * applications nobody touched for `stale_days`) runs in `sweep()`, which the
 * queue screens call when they load.
 */

const DAY = 86400000
const OPEN_COLUMNS = 'id, full_name, interests, team_id, reviewer_id, stage, routed_at, assigned_at, last_activity_at, interview_at'

export async function logEvent(applicationId, kind, fields = {}) {
  const { error } = await supabaseAdmin.from('application_events').insert({
    application_id: applicationId,
    kind,
    from_team_id: fields.fromTeamId ?? null,
    to_team_id: fields.toTeamId ?? null,
    from_reviewer_id: fields.fromReviewerId ?? null,
    to_reviewer_id: fields.toReviewerId ?? null,
    note: fields.note ?? null,
    actor_id: fields.actorId ?? null,
  })
  if (error) console.error('Application event log error:', error.message)
}

/** Everything routing decisions need, read once per request. */
export async function loadContext() {
  const [teams, links, reviewers, open, settings] = await Promise.all([
    supabaseAdmin.from('review_teams').select('*').order('sort_order').order('id'),
    supabaseAdmin.from('interest_teams').select('team_id, interest:interests(key)'),
    supabaseAdmin.from('team_reviewers')
      .select('team_id, admin:admin_users(id, full_name, email, is_active, review_available, review_capacity)'),
    supabaseAdmin.from('membership_applications').select(OPEN_COLUMNS).eq('status', 'pending'),
    supabaseAdmin.from('review_settings').select('stale_days').eq('id', 1).maybeSingle(),
  ])
  for (const r of [teams, links, reviewers, open, settings]) if (r.error) throw r.error

  const teamsByInterest = new Map()
  for (const l of links.data) {
    const key = l.interest?.key
    if (!key) continue
    if (!teamsByInterest.has(key)) teamsByInterest.set(key, [])
    teamsByInterest.get(key).push(l.team_id)
  }

  const reviewersByTeam = new Map()
  for (const r of reviewers.data) {
    if (!r.admin?.is_active) continue
    if (!reviewersByTeam.has(r.team_id)) reviewersByTeam.set(r.team_id, [])
    reviewersByTeam.get(r.team_id).push(r.admin)
  }

  const ctx = {
    teams: teams.data,
    teamsByInterest,
    reviewersByTeam,
    open: open.data,
    staleDays: settings.data?.stale_days ?? 5,
    reviewerLoad: new Map(),
    teamLoad: new Map(),
  }
  recount(ctx)
  return ctx
}

function recount(ctx) {
  ctx.reviewerLoad.clear()
  ctx.teamLoad.clear()
  for (const a of ctx.open) {
    if (a.reviewer_id) ctx.reviewerLoad.set(a.reviewer_id, (ctx.reviewerLoad.get(a.reviewer_id) || 0) + 1)
    if (a.team_id) ctx.teamLoad.set(a.team_id, (ctx.teamLoad.get(a.team_id) || 0) + 1)
  }
}

/** Team with the most matching interests; the shorter queue breaks ties. */
export function pickTeam(interests, ctx) {
  const score = new Map()
  for (const key of interests || []) {
    for (const teamId of ctx.teamsByInterest.get(key) || []) score.set(teamId, (score.get(teamId) || 0) + 1)
  }
  let best = null
  for (const [teamId, s] of score) {
    if (!best || s > best.s || (s === best.s && (ctx.teamLoad.get(teamId) || 0) < (ctx.teamLoad.get(best.teamId) || 0))) {
      best = { teamId, s }
    }
  }
  return best?.teamId ?? null
}

/** Least-loaded reviewer of a team who is available and under capacity. */
export function pickReviewer(teamId, ctx, exclude = []) {
  const candidates = (ctx.reviewersByTeam.get(teamId) || []).filter(r => {
    if (exclude.includes(r.id) || !r.review_available) return false
    const load = ctx.reviewerLoad.get(r.id) || 0
    return r.review_capacity == null || load < r.review_capacity
  })
  candidates.sort((a, b) =>
    (ctx.reviewerLoad.get(a.id) || 0) - (ctx.reviewerLoad.get(b.id) || 0) || a.id - b.id)
  return candidates[0]?.id ?? null
}

/**
 * Move an open application to a team (null = general pool) and, inside it,
 * to a reviewer. Updates the context's load counts so the next pick in the
 * same request sees this one.
 */
export async function placeApplication(app, ctx, { teamId, reviewerId, kind, note, actorId, exclude = [] }) {
  const toReviewer = reviewerId !== undefined
    ? reviewerId
    : teamId ? pickReviewer(teamId, ctx, exclude) : null
  const now = new Date().toISOString()
  const patch = {
    team_id: teamId,
    reviewer_id: toReviewer,
    stage: toReviewer ? (app.stage === 'interview' && toReviewer === app.reviewer_id ? 'interview' : 'assigned') : 'pool',
    routed_at: app.routed_at || now,
    assigned_at: toReviewer ? (toReviewer !== app.reviewer_id ? now : app.assigned_at ?? now) : null,
    last_activity_at: now,
  }
  if (toReviewer !== app.reviewer_id) patch.interview_at = null
  const { error } = await supabaseAdmin.from('membership_applications').update(patch).eq('id', app.id).eq('status', 'pending')
  if (error) throw error

  await logEvent(app.id, kind, {
    fromTeamId: app.team_id, toTeamId: teamId,
    fromReviewerId: app.reviewer_id, toReviewerId: toReviewer,
    note, actorId,
  })
  Object.assign(app, patch)
  recount(ctx)
  return app
}

export async function routeNewApplication(app) {
  const ctx = await loadContext()
  const tracked = ctx.open.find(a => a.id === app.id) || app
  return placeApplication(tracked, ctx, { teamId: pickTeam(app.interests, ctx), kind: 'routed' })
}

/**
 * Housekeeping, safe to run on every queue load:
 *  1. route applications that never went through routing (older rows, or a
 *     routing failure at submit time);
 *  2. give team applications without a reviewer to whoever is free now;
 *  3. reassign applications their reviewer has sat on for `stale_days`.
 *     With nobody else free in the team they stay put and show as stale.
 */
export async function sweep(ctx) {
  ctx = ctx || await loadContext()
  const now = Date.now()
  const staleMs = ctx.staleDays * DAY

  for (const app of ctx.open) {
    if (!app.routed_at) {
      await placeApplication(app, ctx, { teamId: pickTeam(app.interests, ctx), kind: 'routed' })
    } else if (app.team_id && !app.reviewer_id) {
      const reviewerId = pickReviewer(app.team_id, ctx)
      if (reviewerId) await placeApplication(app, ctx, { teamId: app.team_id, reviewerId, kind: 'assigned' })
    } else if (app.reviewer_id && isStale(app, staleMs, now)) {
      if (app.team_id) {
        const reviewerId = pickReviewer(app.team_id, ctx, [app.reviewer_id])
        if (reviewerId) {
          await placeApplication(app, ctx, {
            teamId: app.team_id, reviewerId, kind: 'stale_reassigned',
            note: `No progress for ${ctx.staleDays} days.`,
          })
        }
      } else {
        // Claimed from the general pool and then left: back to the pool.
        await placeApplication(app, ctx, {
          teamId: null, reviewerId: null, kind: 'stale_reassigned',
          note: `No progress for ${ctx.staleDays} days.`,
        })
      }
    }
  }
  return ctx
}

export function isStale(app, staleMs, now = Date.now()) {
  if (!app.reviewer_id) return false
  if (app.stage === 'interview' && app.interview_at) {
    return now - new Date(app.interview_at).getTime() > staleMs
  }
  return now - new Date(app.last_activity_at || 0).getTime() > staleMs
}

// Queue screens load often; housekeeping more than once a minute is waste.
let lastSweep = 0
export async function sweepThrottled() {
  if (Date.now() - lastSweep < 60000) return
  lastSweep = Date.now()
  try {
    await sweep()
  } catch (err) {
    lastSweep = 0
    console.error('Review sweep error:', err.message)
  }
}
