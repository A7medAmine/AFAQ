import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Users } from 'lucide-react'

const spring = { type: 'spring', damping: 28, stiffness: 120 }

export default function IntroSection() {
  const { t } = useTranslation('home')

  return (
    <section className="py-16 md:py-20" style={{ background: 'var(--color-accent-soft)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-30px' }}
          transition={spring}
          className="max-w-3xl mx-auto text-center"
        >
          <div className="eyebrow eyebrow-center mb-5" />
          <h2
            className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight mb-6"
          >
            {t('intro.title')}
          </h2>
          <p
            className="text-base md:text-lg leading-relaxed"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {t('intro.description')}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-30px' }}
          transition={{ ...spring, delay: 0.15 }}
          className="relative mx-auto mt-16 overflow-hidden rounded-2xl"
          style={{
            maxWidth: 1000,
            aspectRatio: '21/9',
            background: 'linear-gradient(135deg, #0A1628 0%, #1a2a4a 50%, #0d1f3c 100%)',
            boxShadow: '0 0 60px rgba(36, 96, 231, 0.25), 0 0 120px rgba(36, 96, 231, 0.1)',
            border: '1px solid rgba(36, 96, 231, 0.15)',
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(circle at 30% 40%, rgba(36, 96, 231, 0.15) 0%, transparent 60%), radial-gradient(circle at 70% 60%, rgba(59, 130, 246, 0.1) 0%, transparent 50%)',
            }}
          />
          <div
            className="absolute"
            style={{
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 300,
              height: 300,
              background: 'radial-gradient(circle, rgba(36, 96, 231, 0.2) 0%, transparent 70%)',
              pointerEvents: 'none',
            }}
          />
          <div className="relative z-10 flex items-center justify-center h-full">
            <div className="text-center">
              <div
                className="inline-flex items-center justify-center rounded-full mb-4"
                style={{
                  width: 72,
                  height: 72,
                  background: 'rgba(36, 96, 231, 0.2)',
                  border: '1px solid rgba(36, 96, 231, 0.3)',
                }}
              >
                <Users size={32} style={{ color: 'rgba(59, 130, 246, 0.8)' }} />
              </div>
              <p
                className="text-lg md:text-xl font-semibold tracking-wide"
                style={{
                  color: 'rgba(255, 255, 255, 0.6)',
                  fontFamily: "'DM Sans', 'Inter', sans-serif",
                  letterSpacing: '0.15em',
                }}
              >
                AFAQ SCIENTIFIC CLUB
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
