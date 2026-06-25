import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, AlertCircle, Info, AlertTriangle, X } from 'lucide-react'
import useAdminStore from '../../store/adminStore'

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
}

const colors = {
  success: '#16a34a',
  error: '#dc2626',
  info: '#2563eb',
  warning: '#d97706',
}

export default function ToastContainer() {
  const toasts = useAdminStore(s => s.toasts)
  const removeToast = useAdminStore(s => s.removeToast)

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      <AnimatePresence>
        {toasts.map(t => {
          const Icon = icons[t.type]
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95 }}
              className="flex items-start gap-3 p-4 rounded-xl border shadow-lg"
              style={{
                background: 'var(--color-card)',
                borderColor: 'var(--color-border-light)',
              }}
            >
              <Icon size={18} style={{ color: colors[t.type], flexShrink: 0, marginTop: 1 }} />
              <p className="text-sm flex-1" style={{ color: 'var(--color-text)' }}>{t.message}</p>
              <button onClick={() => removeToast(t.id)} className="admin-icon-btn p-1 -mr-1 rounded-md" style={{ color: 'var(--color-text-muted)' }}>
                <X size={14} />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
