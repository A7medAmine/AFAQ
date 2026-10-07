import { useState } from 'react'
import { Copy, Link2, Link2Off } from 'lucide-react'
import { logActivity, run, supabase } from '../../lib/db'
import useAdminStore from '../../store/adminStore'
import Modal from '../ui/Modal'
import Button from '../ui/Button'

export const shareUrl = token => `${window.location.origin}/needs/share/${token}`

/**
 * A read-only link to a list for people without a console account, such as
 * a department following its progress. Turning it off makes the old link dead;
 * turning it on again makes a new one.
 */
export default function ShareModal({ open, list, onClose, onChanged }) {
  const addToast = useAdminStore(s => s.addToast)
  const [busy, setBusy] = useState(false)
  const token = list?.share_token

  const setToken = async next => {
    setBusy(true)
    const { ok } = await run(
      supabase.from('need_lists').update({ share_token: next }).eq('id', list.id),
      { success: next ? 'Share link is on.' : 'Share link turned off. The old link no longer works.', failure: 'The share link did not change.' }
    )
    setBusy(false)
    if (!ok) return
    logActivity('updated', 'need_lists', list.id, { name: list.title, shared: !!next })
    onChanged(next)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl(token))
      addToast('Link copied.')
    } catch {
      addToast('Copy failed. Select the link and copy it by hand.', 'error')
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Share a read-only link"
      description="Anyone with the link sees the items, quantities, departments and status. Not who is doing what, not notes, and they can't change anything."
      footer={<Button onClick={onClose} data-dialog-dismiss="true">Close</Button>}
    >
      {token ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input className="adm-input adm-data text-[12px] flex-1" readOnly value={shareUrl(token)} onFocus={e => e.target.select()} aria-label="Share link" />
            <Button icon={Copy} onClick={copy}>Copy</Button>
          </div>
          <Button variant="danger" icon={Link2Off} busy={busy} busyLabel="Turning off…" onClick={() => setToken(null)}>Turn off the link</Button>
        </div>
      ) : (
        <Button variant="primary" icon={Link2} busy={busy} busyLabel="Creating…" onClick={() => setToken(crypto.randomUUID())}>Create a share link</Button>
      )}
    </Modal>
  )
}
