import { useEffect, useState } from 'react'

/** Labels for interest keys, read once per page from the public endpoint. */
export function useInterestLabels() {
  const [labels, setLabels] = useState({})
  useEffect(() => {
    let alive = true
    fetch('/api/interests')
      .then(r => (r.ok ? r.json() : []))
      .then(rows => { if (alive) setLabels(Object.fromEntries(rows.map(i => [i.key, i.label_en]))) })
      .catch(() => {})
    return () => { alive = false }
  }, [])
  return labels
}

/** ISO timestamp → value for <input type="datetime-local">, in local time. */
export function toLocalInput(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function daysSince(value) {
  if (!value) return null
  return Math.floor((Date.now() - new Date(value).getTime()) / 86400000)
}

export const EVENT_LABELS = {
  routed: 'Routed',
  assigned: 'Assigned',
  claimed: 'Claimed',
  released: 'Released',
  transferred: 'Transferred',
  reassigned: 'Reassigned',
  stale_reassigned: 'Reassigned (no progress)',
  interview: 'Interview',
  approved: 'Accepted',
  rejected: 'Rejected',
}
