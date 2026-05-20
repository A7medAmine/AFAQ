import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Cpu, Rocket, Code, Trophy, BookOpen, Radio } from 'lucide-react'
import SectionHeader from '../shared/SectionHeader'
import SideImage from '../shared/SideImage'

const spring = { type: 'spring', damping: 28, stiffness: 120 }

const activityIcons = {
  workshops: Cpu,
  robotics: Rocket,
  hackathons: Radio,
  competitions: Trophy,
  training: BookOpen,
  software: Code,
}

const activityKeys = ['workshops', 'robotics', 'hackathons', 'competitions', 'training', 'software']

const activityGradients = {
  workshops: { from: '#1a1a2e', to: '#16213e' },
  robotics: { from: '#0f3460', to: '#1a1a2e' },
  hackathons: { from: '#16213e', to: '#0f3460' },
  competitions: { from: '#1a2a4a', to: '#0d1f3c' },
  training: { from: '#0d1f3c', to: '#1a2a4a' },
  software: { from: '#0f3460', to: '#16213e' },
}

export default function FeaturedActivities() {
  const { t } = useTranslation('home')

  return (
    <section className="py-16 md:py-20 relative z-0" style={{ background: 'var(--color-bg)' }}>
        <SideImage side="right" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader title={t('activities.title')} subtitle={t('activities.sub')} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {activityKeys.map((key, i) => {
            const Icon = activityIcons[key]
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-30px' }}
                transition={{ ...spring, delay: i * 0.05 }}
                className="card-pro overflow-hidden"
              >
                <div
                  className="relative flex items-center justify-center"
                  style={{
                    height: 140,
                    background: `linear-gradient(135deg, ${activityGradients[key].from}, ${activityGradients[key].to})`,
                  }}
                >
                  <div
                    className="absolute"
                    style={{
                      width: 120,
                      height: 120,
                      borderRadius: '50%',
                      background: 'rgba(36, 96, 231, 0.12)',
                      filter: 'blur(24px)',
                    }}
                  />
                  <Icon
                    size={40}
                    style={{ color: 'rgba(255, 255, 255, 0.5)', position: 'relative', zIndex: 1 }}
                  />
                </div>
                <div className="flex items-start gap-4 p-5">
                  <div className="icon-box" style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0 }}>
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0">
                    <h3
                      className="font-bold text-sm mb-1"
                      style={{ color: 'var(--color-text)' }}
                    >
                      {t(`activities.${key}.title`)}
                    </h3>
                    <p
                      className="text-xs leading-relaxed"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {t(`activities.${key}.desc`)}
                    </p>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
