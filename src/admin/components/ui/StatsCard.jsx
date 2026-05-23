import { useEffect } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'

export default function StatsCard({ icon: Icon, label, value, trend, color = 'var(--color-accent)' }) {
  const count = useMotionValue(0)
  const spring = useSpring(count, { damping: 25, stiffness: 100 })
  const display = useTransform(spring, v => Math.round(v).toLocaleString())

  useEffect(() => { count.set(value) }, [value, count])

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-5 border"
      style={{
        background: 'var(--color-card)',
        borderColor: 'var(--color-border-light)',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}15`, color }}>
          <Icon size={18} />
        </div>
        {trend !== undefined && (
          <span className="text-xs font-medium" style={{ color: trend >= 0 ? 'var(--color-success)' : 'var(--color-error, #dc2626)' }}>
            {trend >= 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <motion.p className="text-2xl font-bold mb-0.5" style={{ color: 'var(--color-text)' }}>{display}</motion.p>
      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
    </motion.div>
  )
}
