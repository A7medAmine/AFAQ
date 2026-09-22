import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import useAdminStore from '../../store/adminStore'

const TONES = {
  success: { icon: CheckCircle2, color: 'var(--adm-ok)' },
  error: { icon: AlertCircle, color: 'var(--adm-fault)' },
  warning: { icon: AlertTriangle, color: 'var(--adm-wait)' },
  info: { icon: Info, color: 'var(--adm-signal)' },
}

export default function ToastContainer() {
  const toasts = useAdminStore(s => s.toasts)
  const removeToast = useAdminStore(s => s.removeToast)

  return (
    <div
      className="adm-no-print fixed bottom-5 right-5 z-[80] flex flex-col gap-2 w-[min(360px,calc(100vw-40px))]"
      role="status"
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        {toasts.map(toast => {
          const tone = TONES[toast.type] || TONES.info
          const Icon = tone.icon
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, x: 32, scale: 0.97 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 32, scale: 0.97 }}
              transition={{ type: 'spring', damping: 26, stiffness: 340 }}
              className="flex items-start gap-2.5 p-3.5 rounded-xl"
              style={{
                background: 'var(--adm-panel)',
                border: '1px solid var(--adm-trace)',
                borderLeft: `3px solid ${tone.color}`,
                boxShadow: 'var(--adm-shadow-lift)',
              }}
            >
              <Icon size={17} style={{ color: tone.color, flexShrink: 0, marginTop: 1 }} />
              <p className="text-sm flex-1" style={{ color: 'var(--adm-silk)' }}>{toast.message}</p>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="adm-icon-btn shrink-0"
                style={{ width: 24, height: 24 }}
                aria-label="Dismiss"
              >
                <X size={13} />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
