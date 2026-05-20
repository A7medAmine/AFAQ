import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Lightbulb, Users, Target, Shield } from 'lucide-react'
import SideImage from '../components/shared/SideImage'

const spring = { type: 'spring', damping: 28, stiffness: 120 }

const valuesData = [
  { key: 'innovation', icon: Lightbulb },
  { key: 'teamwork', icon: Users },
  { key: 'excellence', icon: Target },
  { key: 'integrity', icon: Shield },
]

const timelineData = [
  { year: '2022', key: 'point1' },
  { year: '2023', key: 'point2' },
  { year: '2024', key: 'point3' },
  { year: '2025', key: 'point4' },
  { year: '2026', key: 'point5' },
]

export default function About() {
  const { t } = useTranslation('about')

  return (
    <>
      <section
        className="pt-24 pb-16 md:pt-32 md:pb-20"
        style={{ background: 'var(--color-bg-alt)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={spring}
            className="eyebrow eyebrow-center mb-4"
          >
            {t('hero.title')}
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.1 }}
            className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4"
          >
            {t('hero.title')}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.2 }}
            className="text-lg max-w-2xl mx-auto"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {t('hero.subtitle')}
          </motion.p>
        </div>
      </section>

      <section className="py-16 md:py-20 relative z-0">
        <SideImage side="right" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { key: 'story', texts: ['paragraph1', 'paragraph2'] },
              { key: 'mission', texts: ['text'] },
              { key: 'vision', texts: ['text'] },
            ].map((item, i) => (
              <motion.div
                key={item.key}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-30px' }}
                transition={{ ...spring, delay: i * 0.1 }}
              >
                <div
                  className="w-10 h-1 rounded-full mb-5"
                  style={{ background: 'var(--color-accent)' }}
                />
                <h3
                  className="text-2xl font-bold mb-4"
                >
                  {t(`${item.key}.title`)}
                </h3>
                {item.texts.map((tKey, j) => (
                  <p
                    key={j}
                    className="leading-relaxed mb-3 last:mb-0"
                    style={{ color: 'var(--color-text-muted)', fontSize: 15 }}
                  >
                    {t(`${item.key}.${tKey}`)}
                  </p>
                ))}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <div className="divider-custom" />

      <section className="py-16 md:py-20 relative z-0" style={{ background: 'var(--color-bg-alt)' }}>
        <SideImage side="left" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-30px' }}
            transition={spring}
            className="text-center mb-14"
          >
            <div className="eyebrow eyebrow-center mb-3">{t('values.title')}</div>
            <h2
              className="text-3xl md:text-4xl font-bold"
            >
              {t('values.title')}
            </h2>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {valuesData.map((v, i) => {
              const Icon = v.icon
              return (
                <motion.div
                  key={v.key}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-30px' }}
                  transition={{ ...spring, delay: i * 0.08 }}
                  className="card-pro p-7 text-center"
                >
                  <div
                    className="inline-flex items-center justify-center mb-5"
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 16,
                      background: 'var(--color-accent-soft)',
                      color: 'var(--color-accent)',
                    }}
                  >
                    <Icon size={28} />
                  </div>
                  <h3
                    className="font-bold text-lg mb-2"
                  >
                    {t(`values.${v.key}.title`)}
                  </h3>
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    {t(`values.${v.key}.desc`)}
                  </p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20 relative z-0">
        <SideImage side="right" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-30px' }}
            transition={spring}
            className="text-3xl md:text-4xl font-bold mb-16 text-center"
          >
            {t('special.title')}
          </motion.h2>
          <div className="timeline-track">
            {timelineData.map((item, i) => (
              <motion.div
                key={item.key}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-30px' }}
                transition={{ ...spring, delay: i * 0.1 }}
                className="timeline-node"
              >
                <div className="timeline-dot" />
                <div
                  className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold mb-2"
                  style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}
                >
                  {item.year}
                </div>
                <p className="text-base leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                  {t(`special.${item.key}`)}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
