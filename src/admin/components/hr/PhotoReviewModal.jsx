import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { api, logActivity } from '../../lib/db'
import useAdminStore from '../../store/adminStore'
import { relativeTime } from '../../lib/format'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import EmptyState from '../ui/EmptyState'

// One tap for the usual reasons; members read this note in their portal.
const REASONS = [
  'Please use a clear photo of your face.',
  'Only you should be in the photo.',
  'This photo is not appropriate for a member card.',
]

/**
 * Photos members uploaded from the portal. They stay hidden until approved
 * here; an approved photo becomes the member's photo (card, console).
 */
export default function PhotoReviewModal({ open, members, onClose, onChanged }) {
  const addToast = useAdminStore(s => s.addToast)
  const [busy, setBusy] = useState(null)
  const [refusing, setRefusing] = useState(null) // member id
  const [note, setNote] = useState('')

  const review = async (member, approve) => {
    setBusy(member.id)
    const { ok, message } = await api('/api/portal/photo/review', {
      method: 'POST',
      body: { member_id: member.id, approve, note: approve ? undefined : note },
    })
    setBusy(null)
    if (!ok) { addToast(message || 'The review did not save.', 'error'); return }
    addToast(approve ? `Photo approved for ${member.full_name}.` : `Photo refused for ${member.full_name}.`, 'success')
    logActivity('updated', 'members', member.id, { name: member.full_name, photo: approve ? 'approved' : 'refused' })
    setRefusing(null)
    setNote('')
    onChanged()
  }

  return (
    <Modal open={open} onClose={onClose} size="lg" title="Photos to review"
      description="Uploaded by members from their member area. Nobody sees them until you approve.">
      {members.length === 0 ? (
        <EmptyState compact icon={Check} title="All caught up" description="No photos waiting." />
      ) : (
        <ul className="space-y-3">
          {members.map(m => (
            <li key={m.id} className="adm-panel p-3">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  {m.photo_url
                    ? <img src={m.photo_url} alt="Current" className="w-14 h-14 rounded-full object-cover" style={{ opacity: 0.6 }} />
                    : <div className="w-14 h-14 rounded-full" style={{ background: 'var(--adm-trace)' }} />}
                  <span style={{ color: 'var(--adm-silk-faint)' }}>→</span>
                  <a href={m.photo_pending_url} target="_blank" rel="noreferrer" title="Open full size">
                    <img src={m.photo_pending_url} alt="New photo" className="w-24 h-24 rounded-lg object-cover" />
                  </a>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{m.full_name}</p>
                  <p className="adm-data text-[11px]" style={{ color: 'var(--adm-silk-faint)' }}>
                    {m.member_code} · sent {relativeTime(m.photo_pending_at)}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="primary" icon={Check} busy={busy === m.id && refusing !== m.id} onClick={() => review(m, true)}>Approve</Button>
                  <Button size="sm" variant="danger" icon={X} onClick={() => { setRefusing(refusing === m.id ? null : m.id); setNote(REASONS[0]) }}>Refuse</Button>
                </div>
              </div>
              {refusing === m.id && (
                <div className="mt-3 pt-3 space-y-2" style={{ borderTop: '1px solid var(--adm-trace)' }}>
                  <div className="flex flex-wrap gap-1.5">
                    {REASONS.map(r => (
                      <button key={r} type="button" className={`adm-btn adm-btn-sm ${note === r ? 'adm-btn-primary' : ''}`} onClick={() => setNote(r)}>{r}</button>
                    ))}
                  </div>
                  <input className="adm-input" maxLength={300} value={note} onChange={e => setNote(e.target.value)}
                    aria-label="Reason shown to the member" placeholder="Reason shown to the member" />
                  <Button size="sm" variant="danger" busy={busy === m.id} onClick={() => review(m, false)}>Refuse with this reason</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
