/**
 * Points vocabulary shared by the Points page, the HR overview and the
 * department dashboard. point_entries is an append-only ledger: a member's
 * balance is the sum of their rows.
 */

export const POINT_CATEGORIES = [
  { value: 'event', label: 'Event' },
  { value: 'task', label: 'Task' },
  { value: 'contribution', label: 'Contribution' },
  { value: 'bonus', label: 'Bonus' },
  { value: 'penalty', label: 'Penalty' },
  { value: 'reset', label: 'Reset' },
  { value: 'other', label: 'Other' },
]

/** Categories offered when giving points by hand; resets have their own button. */
export const MANUAL_CATEGORIES = POINT_CATEGORIES.filter(c => c.value !== 'reset')

export function categoryLabel(value) {
  return POINT_CATEGORIES.find(c => c.value === value)?.label || value || '—'
}

/** Balance per member id from rows of point_entries ({ member_id, points }). */
export function balances(entries = []) {
  const totals = {}
  entries.forEach(e => { totals[e.member_id] = (totals[e.member_id] || 0) + e.points })
  return totals
}

/** "+10", "−5", "0" — the sign always shows, so a penalty never reads as a gain. */
export function formatPoints(n) {
  if (!n) return '0'
  return n > 0 ? `+${n}` : `−${Math.abs(n)}`
}

export function pointsTone(n) {
  if (!n) return 'neutral'
  return n > 0 ? 'ok' : 'fault'
}
