import { useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Users } from 'lucide-react'
import Card from '../components/shared/Card'
import { projects } from '../data'

const spring = { type: 'spring', damping: 28, stiffness: 120 }

const categories = ['all', 'robotics', 'electronics', 'software', 'iot']

export default function Projects() {
  const { t } = useTranslation('projects')
  const [active, setActive] = useState('all')

  const filtered = active === 'all' ? projects : projects.filter(p => p.category === active)

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

      <section className="py-16 md:py-20 -mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-center gap-2 mb-12">
            {categories.map(c => (
              <button
                key={c}
                onClick={() => setActive(c)}
                className={`pill ${active === c ? 'active' : ''}`}
              >
                {t(`filters.${c}`)}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <p className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>
              {t('noProjects')}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((p, i) => (
                <Card key={p.id} delay={i * 0.07}>
                  <div className="card-image-overlay relative" style={{ height: 200, background: 'var(--color-bg-alt)' }}>
                    <img
                      src={p.image}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="category-tag">
                      {t(`filters.${p.category}`)}
                    </div>
                  </div>
                  <div className="p-7">
                    <div className="flex items-center justify-between mb-3">
                      <span
                        className="text-xs flex items-center gap-1.5"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        <Users size={12} /> {p.team} {t('card.members')}
                      </span>
                    </div>
                    <h3
                      className="font-bold text-lg mb-2 leading-snug"
                    >
                      {t(`${p.key}.title`)}
                    </h3>
                    <p
                      className="text-sm mb-4 line-clamp-2 leading-relaxed"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {t(`${p.key}.desc`)}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {p.tech.map(tch => (
                        <span key={tch} className="tech-tag">{tch}</span>
                      ))}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  )
}
