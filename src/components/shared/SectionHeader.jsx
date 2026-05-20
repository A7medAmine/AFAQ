import { motion } from 'framer-motion'

export default function SectionHeader({ title, subtitle, light = false, center = true, number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-30px' }}
      transition={{ type: 'spring', damping: 28, stiffness: 120 }}
      className={`mb-10 md:mb-14 relative ${center ? 'text-center' : ''}`}
    >
      {number && (
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 select-none pointer-events-none"
          style={{
            fontFamily: "'DM Sans', 'Inter', sans-serif",
            fontWeight: 900,
            fontSize: 'clamp(100px, 20vw, 220px)',
            color: 'var(--color-accent)',
            opacity: 0.04,
            lineHeight: 1,
          }}
        >
          {String(number).padStart(2, '0')}
        </div>
      )}

      <div className={`eyebrow mb-4 ${center ? 'eyebrow-center' : ''}`}>
        <motion.span
          initial={{ width: 0 }}
          whileInView={{ width: 28 }}
          viewport={{ once: true }}
          transition={{ type: 'spring', damping: 28, stiffness: 120, delay: 0.15 }}
          style={{ height: 2.5, background: 'var(--color-accent)', borderRadius: 2, display: center ? 'none' : 'inline-block', flexShrink: 0 }}
        />
        {number && <span className="label-text">0{number}</span>}
      </div>

      <h2
        className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight"
        style={{
          color: light ? '#fff' : 'var(--color-text)',
        }}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className="mt-4 text-base md:text-lg max-w-2xl leading-relaxed"
          style={{
            color: light ? 'rgba(255,255,255,0.7)' : 'var(--color-text-muted)',
            marginLeft: center ? 'auto' : undefined,
            marginRight: center ? 'auto' : undefined,
          }}
        >
          {subtitle}
        </p>
      )}
    </motion.div>
  )
}
