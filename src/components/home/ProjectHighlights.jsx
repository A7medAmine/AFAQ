import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ChevronRight, Users } from 'lucide-react'
import SectionHeader from '../shared/SectionHeader'
import Card from '../shared/Card'
import { projects } from '../../data'

const spring = { type: 'spring', damping: 28, stiffness: 120 }

const emojiMap = {
  iot: '🌿',
  robotics: '🤖',
  software: '💻',
  electronics: '⚡',
}

export default function ProjectHighlights() {
  const { t } = useTranslation('home')

  const featured = projects.slice(0, 3)

  return (
    <section className="py-16 md:py-20" style={{ background: 'var(--color-accent-soft)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader title={t('projects.title')} />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {featured.map((p, i) => (
            <Card key={p.id} delay={i * 0.08}>
              <div className="card-image-overlay relative" style={{ height: 200, background: 'var(--color-bg-alt)' }}>
                <img
                  src={p.image}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="category-tag">
                  {t(`projects:filters.${p.category}`)}
                </div>
              </div>
              <div className="p-7">
                <div className="flex items-center justify-between mb-3">
                  <span
                    className="text-xs flex items-center gap-1.5"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    <Users size={12} /> {p.team} {t('projects:card.members')}
                  </span>
                </div>
                <h3
                  className="font-bold text-lg mb-2 leading-snug"
                  style={{ fontFamily: "'DM Sans', 'Inter', sans-serif", fontWeight: 700 }}
                >
                  {t(`projects:${p.key}.title`)}
                </h3>
                <p
                  className="text-sm mb-4 line-clamp-2 leading-relaxed"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {t(`projects:${p.key}.desc`)}
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

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-30px' }}
          transition={spring}
          className="text-center mt-10"
        >
          <Link
            to="/projects"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-[100px] font-semibold text-sm transition-all duration-200"
            style={{ background: 'transparent', color: 'var(--color-accent)', border: '1.5px solid var(--color-accent)' }}
          >
            {t('projects.viewAll')} <ChevronRight size={15} />
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
