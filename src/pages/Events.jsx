import { useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { MapPin } from 'lucide-react'
import Card from '../components/shared/Card'
import { events } from '../data'

const spring = { type: 'spring', damping: 28, stiffness: 120 }

export default function Events() {
  const { t } = useTranslation('events')
  const [tab, setTab] = useState('upcoming')

  const filtered = events.filter(e => tab === 'upcoming' ? e.upcoming : !e.upcoming)

  const formatDate = (dateStr) => {
    const parts = dateStr.split(' ')
    const day = parts[1] ? parts[1].replace(',', '') : ''
    const month = parts[0] ? parts[0].substring(0, 3).toUpperCase() : ''
    return { day, month }
  }

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
          <div className="flex justify-center mb-12">
            <div className="flex gap-8" style={{ borderBottom: '2px solid var(--color-border-light)' }}>
              {['upcoming', 'past'].map(tabKey => (
                <button
                  key={tabKey}
                  onClick={() => setTab(tabKey)}
                  className="relative pb-3 text-sm font-semibold transition-colors"
                  style={{
                    color: tab === tabKey ? 'var(--color-accent)' : 'var(--color-text-muted)',
                  }}
                >
                  {tabKey === 'upcoming' ? t('upcoming') : t('past')}
                  {tab === tabKey && (
                    <motion.div
                      layoutId="tab-underline"
                      className="absolute bottom-0 left-0 right-0 h-0.5"
                      style={{ background: 'var(--color-accent)' }}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>
              {tab === 'upcoming' ? t('noUpcoming') : ''}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((e, i) => {
                const dateInfo = formatDate(t(`${e.key}.date`))
                return (
                  <Card key={e.id} delay={i * 0.08}>
                    <div className={`${!e.upcoming ? 'past-event' : ''}`}>
                      <div className="card-image-overlay relative" style={{ aspectRatio: '16/9', background: 'var(--color-bg-alt)' }}>
                        <img
                          src={e.image}
                          alt=""
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        <div className="date-badge">
                          <span className="date-badge-day">{dateInfo.day}</span>
                          <span className="date-badge-month">{dateInfo.month}</span>
                        </div>
                        <div className="category-tag">
                          {e.upcoming ? t('upcoming') : t('past')}
                        </div>
                      </div>
                      <div className="p-7">
                        <h3
                          className="font-bold text-lg mb-2"
                        >
                          {t(`${e.key}.title`)}
                        </h3>
                        <p
                          className="text-sm mb-3 line-clamp-2 leading-relaxed"
                          style={{ color: 'var(--color-text-muted)' }}
                        >
                          {t(`${e.key}.desc`)}
                        </p>
                        <div
                          className="flex items-center gap-3 text-xs mb-4"
                          style={{ color: 'var(--color-text-muted)' }}
                        >
                          <span className="flex items-center gap-1.5">
                            <MapPin size={12} /> {t(`${e.key}.location`)}
                          </span>
                        </div>
                        {e.upcoming && (
                          <a
                            href="/register"
                            className="inline-flex items-center justify-center w-full px-4 py-2.5 rounded-[100px] font-semibold text-sm transition-all duration-200"
                            style={{ background: 'var(--color-accent)', color: '#fff' }}
                          >
                            {t('register')}
                          </a>
                        )}
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </>
  )
}
