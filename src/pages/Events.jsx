import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { MapPin, CalendarPlus } from 'lucide-react'
import Card from '../components/shared/Card'
import SideImage from '../components/shared/SideImage'
import { supabase } from '../lib/supabase'
import SEO from '../components/SEO'
import AddToCalendar from '../components/shared/AddToCalendar'

const spring = { type: 'spring', damping: 28, stiffness: 120 }

export default function Events() {
  const { t, i18n } = useTranslation('events')
  const lang = i18n.language
  const [events, setEvents] = useState([])
  const [tab, setTab] = useState('upcoming')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('events')
      .select('*')
      .eq('is_published', true)
      .order('date', { ascending: false })
      .then(({ data }) => {
        setEvents(data || [])
        setLoading(false)
      })
  }, [])

  const today = new Date().toISOString().split('T')[0]
  const upcoming = events.filter(e => e.date >= today)
  const past = events.filter(e => e.date < today)
  const filtered = tab === 'upcoming' ? upcoming : past

  const tField = (obj, field) => obj[`${field}_${lang}`] || obj[`${field}_en`] || ''

  const formatDate = (dateStr) => {
    if (!dateStr) return { day: '', month: '' }
    const d = new Date(dateStr + 'T00:00:00')
    const day = d.getDate().toString()
    const month = d.toLocaleString('en', { month: 'short' }).toUpperCase()
    return { day, month }
  }

  return (
    <>
      <SEO title={t('hero.title')} description={t('hero.subtitle')} path="/events" />
      <section className="pt-24 pb-16 md:pt-32 md:pb-20" style={{ background: 'var(--color-bg-alt)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="eyebrow eyebrow-center mb-4">
            {t('hero.title')}
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.1 }} className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4">
            {t('hero.title')}
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.2 }} className="text-lg max-w-2xl mx-auto mb-2" style={{ color: 'var(--color-text-muted)' }}>
            {t('hero.subtitle')}
          </motion.p>
          <a href="/api/events/calendar.ics" className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--color-accent)' }}>
            <CalendarPlus size={13} /> {t('subscribe')}
          </a>
        </div>
      </section>

      <section className="py-16 md:py-20 -mt-12 relative z-0">
        <SideImage side="right" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center mb-12">
            <div className="flex gap-8" style={{ borderBottom: '2px solid var(--color-border-light)' }}>
              {['upcoming', 'past'].map(tabKey => (
                <button key={tabKey} onClick={() => setTab(tabKey)} className="relative pb-3 text-sm font-semibold transition-colors"
                  style={{ color: tab === tabKey ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
                  {tabKey === 'upcoming' ? t('upcoming') : t('past')}
                  {tab === tabKey && (
                    <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: 'var(--color-accent)' }} />
                  )}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="rounded-2xl" style={{ height: 360, background: 'var(--color-bg-alt)', animation: 'shimmer 1.5s ease-in-out infinite' }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>
              {tab === 'upcoming' ? t('noUpcoming') : ''}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((e, i) => {
                const dateInfo = formatDate(e.date)
                const isUpcoming = e.date >= today
                return (
                  <Card key={e.id} delay={i * 0.08}>
                    <div className={`${!isUpcoming ? 'past-event' : ''}`}>
                      <div className="card-image-overlay relative" style={{ aspectRatio: '16/9', background: 'var(--color-bg-alt)' }}>
                        {e.poster_url ? (
                          <img src={e.poster_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs" style={{ color: 'var(--color-text-muted)' }}>No image</div>
                        )}
                        <div className="date-badge">
                          <span className="date-badge-day">{dateInfo.day}</span>
                          <span className="date-badge-month">{dateInfo.month}</span>
                        </div>
                        <div className="category-tag">
                          {isUpcoming ? t('upcoming') : t('past')}
                        </div>
                      </div>
                      <div className="p-7">
                        <h3 className="font-bold text-lg mb-2">{tField(e, 'title')}</h3>
                        <p className="text-sm mb-3 line-clamp-2 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                          {tField(e, 'description')}
                        </p>
                        <div className="flex items-center gap-3 text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
                          <span className="flex items-center gap-1.5">
                            <MapPin size={12} /> {tField(e, 'location')}
                          </span>
                        </div>
                        {isUpcoming && (
                          <div className="mb-3">
                            <AddToCalendar eventId={e.id} label={t('addToCalendar')} />
                          </div>
                        )}
                        {isUpcoming && e.registration_open && (
                          /* Carry the event through, so the form opens with
                             this one already chosen instead of dropping people
                             on an empty picker. */
                          <Link
                            to={`/register?event=${e.id}`}
                            className="inline-flex items-center justify-center w-full px-4 py-2.5 rounded-[100px] font-semibold text-sm transition-all duration-200"
                            style={{ background: 'var(--color-accent)', color: '#fff' }}
                          >
                            {t('register')}
                          </Link>
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
