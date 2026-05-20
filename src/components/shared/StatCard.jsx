import { motion } from 'framer-motion'

export default function StatCard({ value, label, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-30px' }}
      transition={{ type: 'spring', damping: 28, stiffness: 120, delay }}
      className="stat-card"
    >
      <div className="stat-number">{value}</div>
      <div className="stat-label">{label}</div>
    </motion.div>
  )
}
