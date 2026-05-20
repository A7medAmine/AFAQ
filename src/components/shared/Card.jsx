import { motion } from 'framer-motion'

export default function Card({ children, className = '', delay = 0, hover = true }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-30px' }}
      transition={{ type: 'spring', damping: 28, stiffness: 120, delay }}
      className={`card-pro ${className}`}
      whileHover={hover ? { y: -8, transition: { duration: 0.25 } } : {}}
    >
      {children}
    </motion.div>
  )
}
