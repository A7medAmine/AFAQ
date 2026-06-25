import Modal from './Modal'

export default function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmText = 'Delete', danger = true }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>{message}</p>
      <div className="flex gap-3 justify-end">
        <button
          onClick={onClose}
          className="admin-btn px-4 py-2 rounded-xl text-sm font-medium border"
          style={{ borderColor: 'var(--color-border-light)', color: 'var(--color-text)' }}
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-all hover:brightness-110 hover:-translate-y-0.5 active:brightness-95"
          style={{ background: danger ? '#dc2626' : 'var(--color-accent)' }}
        >
          {confirmText}
        </button>
      </div>
    </Modal>
  )
}
