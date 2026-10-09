import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useDialog } from './useDialog'

const SIZES = { sm: 420, md: 560, lg: 760, xl: 1000 }

export default function Modal({ open, onClose, title, description, size = 'md', footer, children }) {
  const dialogRef = useDialog(open, onClose)

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0"
            style={{ background: 'rgba(6, 10, 16, 0.55)', backdropFilter: 'blur(2px)' }}
            onClick={onClose}
          />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 14, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.985 }}
            transition={{ type: 'spring', damping: 28, stiffness: 340 }}
            className="relative w-full flex flex-col max-h-[92vh] sm:max-h-[86vh]"
            style={{
              maxWidth: SIZES[size] || SIZES.md,
              background: 'var(--adm-panel)',
              border: '1px solid var(--adm-trace)',
              borderRadius: 16,
              boxShadow: 'var(--adm-shadow-lift)',
            }}
          >
            <div className="adm-panel-head shrink-0">
              <div className="min-w-0">
                <h2 className="text-base leading-tight">{title}</h2>
                {description && (
                  <p className="text-xs mt-1" style={{ color: 'var(--adm-silk-faint)' }}>{description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                data-dialog-dismiss="true"
                className="adm-icon-btn shrink-0"
                aria-label="Close"
              >
                <X size={17} />
              </button>
            </div>

            <div className="adm-scroll overflow-y-auto px-4 sm:px-5 py-5 flex-1">{children}</div>

            {footer && (
              <div
                className="shrink-0 flex flex-wrap items-center justify-end gap-2.5 px-4 sm:px-5 py-3.5"
                style={{ borderTop: '1px solid var(--adm-trace)' }}
              >
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
