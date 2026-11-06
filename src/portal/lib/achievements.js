import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { portalRpc } from './portal'

/**
 * Game-style progress for the member portal: point tiers, collectible cards,
 * avatar frames and badges. Everything is worked out here from portal_me and
 * the member's own points history, so nothing new is stored on the server.
 * The look a member picks is kept in this browser only and nobody else sees it.
 */

/** Every member joins with this many points; the tiers count up from here. */
export const START_POINTS = 100

/**
 * Point tiers, lowest first. `min` is the XP a member needs to reach the tier:
 * the starting points plus what they have earned since. Most awards are worth
 * 5, so the steps are a few events apart.
 */
export const TIERS = [
  { key: 'rookie', min: START_POINTS, rarity: 'common' },
  { key: 'explorer', min: START_POINTS + 10, rarity: 'uncommon' },
  { key: 'builder', min: START_POINTS + 25, rarity: 'rare' },
  { key: 'innovator', min: START_POINTS + 50, rarity: 'epic' },
  { key: 'visionary', min: START_POINTS + 100, rarity: 'legendary' },
  { key: 'luminary', min: START_POINTS + 175, rarity: 'mythic' },
]

const tierXp = key => TIERS.find(t => t.key === key).min

/**
 * Card designs in prestige order, so the last unlocked one is the best.
 * Tier cards open with XP; role cards only with the office they belong to.
 */
export const CARDS = [
  ...TIERS.map((t, i) => ({ key: t.key, rarity: t.rarity, xp: i === 0 ? 0 : t.min })),
  { key: 'council', rarity: 'role', role: 'council' },
  { key: 'vanguard', rarity: 'role', role: 'vice' },
  { key: 'sovereign', rarity: 'role', role: 'president' },
]

/** Avatar frames, in the same prestige order as the cards. */
export const FRAMES = [
  { key: 'none', rarity: 'common', xp: 0 },
  { key: 'pixel', rarity: 'common', xp: 0 },
  { key: 'window', rarity: 'uncommon', xp: tierXp('explorer') },
  { key: 'circuit', rarity: 'rare', xp: tierXp('builder') },
  { key: 'spark', rarity: 'epic', xp: tierXp('innovator') },
  { key: 'arcade', rarity: 'legendary', xp: tierXp('visionary') },
  { key: 'glitch', rarity: 'mythic', xp: tierXp('luminary') },
  { key: 'shield', rarity: 'role', role: 'council' },
  { key: 'halo', rarity: 'role', role: 'vice' },
  { key: 'crown', rarity: 'role', role: 'president' },
]

/**
 * Badges with their goals. `levels` are bronze, silver, gold; a badge with a
 * single goal has one level. `lowerIsBetter` is for ranks, where #1 beats #10.
 */
export const BADGES = [
  { key: 'firstSpark', levels: [1], value: s => s.earned },
  { key: 'eventGoer', levels: [1, 3, 8], value: s => s.events },
  { key: 'taskMaster', levels: [1, 3, 8], value: s => s.tasks },
  { key: 'helper', levels: [1, 2, 5], value: s => s.contributions },
  { key: 'topRank', levels: [10, 3, 1], value: s => s.rank, lowerIsBetter: true },
  { key: 'veteran', levels: [3, 6, 12], value: s => s.months },
  { key: 'faceOfAfaq', levels: [1], value: s => s.photo },
  { key: 'teamPlayer', levels: [1], value: s => s.departments },
  { key: 'board', levels: [1], value: s => s.office },
]

const today = () => new Date().toISOString().slice(0, 10)

/** Offices held now, by title. */
export const currentPositions = me => (me?.positions || []).filter(p => !p.term_end || p.term_end >= today())

/**
 * Which role-only items the member may use: president and vice president get
 * their own, and every current office holder or console admin is on the council.
 */
export function memberRoles(me) {
  const titles = new Set(currentPositions(me).map(p => p.title))
  const roles = new Set()
  if (titles.has('president')) roles.add('president')
  if (titles.has('vice_president')) roles.add('vice')
  if (titles.size || me?.admin_role) roles.add('council')
  return roles
}

const monthsSince = date => {
  if (!date) return 0
  const from = new Date(`${String(date).slice(0, 10)}T00:00:00`)
  const now = new Date()
  return Math.max(0, (now.getFullYear() - from.getFullYear()) * 12 + now.getMonth() - from.getMonth() - (now.getDate() < from.getDate() ? 1 : 0))
}

/**
 * XP is every point earned so far. Resets of the points table do not take it
 * away (a reset is bookkeeping, not a punishment); penalties do. Until the
 * history loads, the current balance stands in.
 */
export function progressFor(me, entries) {
  const counted = (entries || []).filter(e => e.category !== 'reset')
  const lifetime = counted.reduce((sum, e) => sum + e.points, 0)
  const xp = Math.max(0, me.points || 0, entries ? lifetime : 0)
  const earnedIn = category => counted.filter(e => e.points > 0 && e.category === category).length

  let tierIndex = 0
  TIERS.forEach((t, i) => { if (xp >= t.min) tierIndex = i })
  const tier = TIERS[tierIndex]
  const next = TIERS[tierIndex + 1] || null
  const roles = memberRoles(me)

  const stats = {
    earned: counted.filter(e => e.points > 0).length,
    events: earnedIn('event'),
    tasks: earnedIn('task'),
    contributions: earnedIn('contribution'),
    rank: me.rank || null,
    months: monthsSince(me.joined_at),
    photo: me.photo_url ? 1 : 0,
    departments: me.departments?.length || 0,
    office: roles.has('council') ? 1 : 0,
  }

  return {
    xp,
    tier,
    tierIndex,
    next,
    // Share of the way from this tier to the next, 0 to 1.
    // (clamped: a member below the starting points after penalties is still a rookie).
    toNext: next ? Math.min(1, Math.max(0, (xp - tier.min) / (next.min - tier.min))) : 1,
    roles,
    stats,
    loaded: Boolean(entries),
  }
}

export const isUnlocked = (item, progress) =>
  item.role ? progress.roles.has(item.role) : progress.xp >= item.xp

/** Where a badge stands: how many levels are done and the next goal. */
export function badgeState(badge, stats) {
  const value = badge.value(stats)
  const reached = level => (badge.lowerIsBetter ? value != null && value <= level : (value || 0) >= level)
  const done = badge.levels.filter(reached).length
  const goal = badge.levels[done] ?? null
  let share = 1
  if (goal != null) {
    if (badge.lowerIsBetter) {
      // Ranks have no natural start, so the bar only fills once you are near.
      const from = badge.levels[done - 1] ?? Math.max(goal * 3, 30)
      share = value == null ? 0 : Math.min(1, Math.max(0, (from - value) / (from - goal)))
    } else {
      share = Math.min(1, (value || 0) / goal)
    }
  }
  return { value, done, goal, share, total: badge.levels.length }
}

// ---------- Points history, shared by the page and the portal header ----------

let history = null

/** The member's points history, fetched once and shared; `fresh` refetches it. */
export function loadHistory(memberId, fresh = false) {
  if (!history || history.memberId !== memberId || fresh) {
    const promise = portalRpc('portal_points').then(({ data }) => {
      if (!data && history?.promise === promise) history = null
      return data
    })
    history = { memberId, promise }
  }
  return history.promise
}

/** Progress for the signed-in member; recomputed once the history arrives. */
export function useProgress(me, { fresh = false } = {}) {
  const [entries, setEntries] = useState(null)
  useEffect(() => {
    let live = true
    loadHistory(me.id, fresh).then(data => { if (live && data) setEntries(data) })
    return () => { live = false }
  }, [me.id, fresh])
  return useMemo(() => ({ ...progressFor(me, entries), entries }), [me, entries])
}

// ---------- The look a member picked (card, frame), kept in this browser ----------

const LOOK_EVENT = 'afaq-portal-look'
const lookKey = id => `afaq-portal-look:${id}`

function readRaw(id) {
  try { return localStorage.getItem(lookKey(id)) || '' } catch { return '' }
}

function subscribe(callback) {
  window.addEventListener(LOOK_EVENT, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(LOOK_EVENT, callback)
    window.removeEventListener('storage', callback)
  }
}

/** { card, frame, seen } as saved for this member, or {} when nothing is. */
export function useLook(memberId) {
  const raw = useSyncExternalStore(subscribe, () => readRaw(memberId), () => '')
  return useMemo(() => {
    try { return JSON.parse(raw) || {} } catch { return {} }
  }, [raw])
}

export function saveLook(memberId, look) {
  try {
    localStorage.setItem(lookKey(memberId), JSON.stringify(look))
  } catch { /* private mode: the pick lasts until the page closes */ }
  window.dispatchEvent(new Event(LOOK_EVENT))
}

const best = (items, progress) => [...items].reverse().find(item => isUnlocked(item, progress))

/**
 * The card and frame to show: the member's pick while it is still unlocked,
 * otherwise the most prestigious one they have.
 */
export function resolveLook(look, progress) {
  const pick = (items, key) => {
    const chosen = items.find(item => item.key === key)
    return chosen && isUnlocked(chosen, progress) ? chosen : best(items, progress)
  }
  return { card: pick(CARDS, look.card), frame: pick(FRAMES, look.frame) }
}

/** Keys of every card and frame the member has, for "new" markers. */
export const unlockedKeys = progress => [
  ...CARDS.filter(c => isUnlocked(c, progress)).map(c => `card:${c.key}`),
  ...FRAMES.filter(f => isUnlocked(f, progress)).map(f => `frame:${f.key}`),
]

// ---------- Member of the month ----------

let motm = null

/**
 * { month: 'YYYY-MM', points } when the signed-in member was last month's
 * member of the month, otherwise null. Asked once per member and page load.
 */
export function useMemberOfMonth(memberId) {
  const [value, setValue] = useState(null)
  useEffect(() => {
    let live = true
    if (!motm || motm.memberId !== memberId) {
      motm = { memberId, promise: portalRpc('portal_member_of_month').then(({ data }) => data || null) }
    }
    motm.promise.then(data => { if (live) setValue(data) })
    return () => { live = false }
  }, [memberId])
  return value
}

/** "October 2026" in the reader's language, from 'YYYY-MM'. */
export function monthLabel(month, lang) {
  if (!month) return ''
  const locale = { ar: 'ar-DZ', fr: 'fr-FR' }[lang] || 'en-GB'
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${month}-15T00:00:00Z`))
}
