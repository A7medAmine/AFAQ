import { useEffect, useState } from 'react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { TextArea } from '../ui/Field'

const MIN_REASON = 3

/**
 * Rejection asks for a reason. Typing one is the pause that catches a slip of
 * the mouse, and the reason lands in the application's history for later.
 */
export default function RejectDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Reject' }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (open) setReason('') }, [open])

  const ready = reason.trim().length >= MIN_REASON

  const confirm = async () => {
    if (!ready) return
    setBusy(true)
    try {
      await onConfirm(reason.trim())
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button onClick={onClose} disabled={busy} data-dialog-dismiss="true">Cancel</Button>
          <Button variant="danger" onClick={confirm} disabled={!ready} busy={busy} busyLabel="Rejecting…">
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm" style={{ color: 'var(--adm-silk-dim)' }}>{message}</p>
        <TextArea
          label="Reason"
          required
          rows={3}
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Why is this application rejected?"
          hint="Kept in the application's history. Not sent to the applicant."
          autoFocus
        />
      </div>
    </Modal>
  )
}
