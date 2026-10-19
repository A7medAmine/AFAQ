import { useEffect, useState } from 'react'
import { api, logActivity } from './db'
import useAdminStore from '../store/adminStore'

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
  restored: 'Restored to pending',
}

/** Put a rejected application back to pending. Resolves true when it worked. */
export async function restoreApplication(app, note) {
  const addToast = useAdminStore.getState().addToast
  const { ok, message } = await api(`/api/review/applications/${app.id}/restore`, { method: 'POST', body: { note } })
  if (!ok) { addToast(message, 'error'); return false }
  logActivity('restored', 'membership_applications', app.id, { name: app.full_name })
  addToast(`${app.full_name} is back to pending.`)
  return true
}

/**
 * Reject through the server (it logs the event and the reason), then offer
 * Undo for a few seconds. `onChanged` reloads the caller's list.
 */
export async function rejectApplication(app, reason, onChanged) {
  const addToast = useAdminStore.getState().addToast
  const { ok, message } = await api(`/api/review/applications/${app.id}/decide`, {
    method: 'POST', body: { decision: 'rejected', note: reason },
  })
  if (!ok) { addToast(message, 'error'); return false }
  logActivity('rejected', 'membership_applications', app.id, { name: app.full_name })
  addToast(`${app.full_name} rejected.`, 'success', {
    action: {
      label: 'Undo',
      onClick: async () => { if (await restoreApplication(app, 'Undo right after rejecting.')) onChanged?.() },
    },
  })
  return true
}
