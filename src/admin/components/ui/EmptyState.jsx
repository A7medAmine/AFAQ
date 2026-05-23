import { motion } from 'framer-motion'
import { Inbox } from 'lucide-react'

export default function EmptyState({ icon: Icon, title, description, action }) {
  const I = Icon || Inbox
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'var(--color-bg-alt)' }}>
        <I size={24} style={{ color: 'var(--color-text-muted)' }} />
      </div>
      <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--color-text)' }}>{title}</h3>
      {description && (
        <p className="text-sm max-w-xs" style={{ color: 'var(--color-text-muted)' }}>{description}</p>
      )}
      {action}
    </motion.div>
  )
}
