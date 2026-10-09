import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useDialog } from './useDialog'

/**
 * Side panel for reading a record without losing your place in the list.
 * Applicants send skills, interests and a motivation letter; until now the
 * console collected all of it and showed none of it.
 */
export default function Drawer({ open, onClose, title, subtitle, badge, footer, children, width = 480 }) {
  const dialogRef = useDialog(open, onClose)

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[55]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0"
            style={{ background: 'rgba(6, 10, 16, 0.45)' }}
            onClick={onClose}
          />
          <motion.aside
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            className="absolute right-0 top-0 bottom-0 w-full flex flex-col"
            style={{
              maxWidth: width,
              background: 'var(--adm-panel)',
              borderLeft: '1px solid var(--adm-trace)',
              boxShadow: 'var(--adm-shadow-lift)',
            }}
          >
            <header className="adm-panel-head shrink-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-base leading-tight adm-truncate">{title}</h2>
                  {badge}
                </div>
                {subtitle && (
                  <p className="text-xs mt-1 adm-truncate" style={{ color: 'var(--adm-silk-faint)' }}>{subtitle}</p>
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
            </header>

            <div className="adm-scroll flex-1 overflow-y-auto px-4 sm:px-5 py-5">{children}</div>

            {footer && (
              <div
                className="shrink-0 flex flex-wrap items-center justify-end gap-2.5 px-4 sm:px-5 py-3.5"
                style={{ borderTop: '1px solid var(--adm-trace)' }}
              >
                {footer}
              </div>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  )
}

/** Label-over-value row used throughout drawers. */
export function DetailRow({ label, children, mono = false }) {
  if (children === null || children === undefined || children === '') return null
  return (
    <div>
      <p className="adm-eyebrow mb-1.5">{label}</p>
      <div className={`text-sm ${mono ? 'adm-data' : ''}`} style={{ color: 'var(--adm-silk)' }}>{children}</div>
    </div>
  )
}

export function TagList({ items, empty = '—' }) {
  if (!items?.length) return <span style={{ color: 'var(--adm-silk-faint)' }}>{empty}</span>
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(item => (
        <span
          key={item}
          className="px-2 py-0.5 rounded-md text-xs"
          style={{ background: 'var(--adm-board-sunk)', color: 'var(--adm-silk-dim)' }}
        >
          {item}
        </span>
      ))}
    </div>
  )
}
