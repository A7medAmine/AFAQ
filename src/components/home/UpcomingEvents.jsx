import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ChevronRight, MapPin } from 'lucide-react'
import Card from '../shared/Card'
import SideImage from '../shared/SideImage'
import { supabase } from '../../lib/supabase'

const spring = { type: 'spring', damping: 28, stiffness: 120 }

export default function UpcomingEvents() {
  const { t, i18n } = useTranslation('home')
  const lang = i18n.language
  const [events, setEvents] = useState([])

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    supabase
      .from('events')
      .select('*')
      .eq('is_published', true)
      .gte('date', today)
      .order('date', { ascending: true })
      .limit(3)
      .then(({ data }) => setEvents(data || []))
  }, [])

  const tField = (obj, field) => obj[`${field}_${lang}`] || obj[`${field}_en`] || ''

  const formatDate = (dateStr) => {
    if (!dateStr) return { day: '', month: '' }
    const d = new Date(dateStr + 'T00:00:00')
    return {
      day: d.getDate().toString(),
      month: d.toLocaleString('en', { month: 'short' }).toUpperCase(),
    }
  }

  if (events.length === 0) return null

  return (
    <section className="py-16 md:py-20 relative z-0" style={{ background: 'var(--color-bg)' }}>
      <SideImage side="left" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="eyebrow eyebrow-center mb-4">{t('upcomingEvents.title')}</div>
          <h2 className="text-3xl md:text-4xl font-bold">{t('upcomingEvents.title')}</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {events.slice(0, 1).map(e => {
            const dateInfo = formatDate(e.date)
            return (
              <Card key={e.id} delay={0} className="lg:col-span-2">
                <div className="grid grid-cols-1 md:grid-cols-2 h-full">
                  <div className="card-image-overlay relative overflow-hidden" style={{ minHeight: 260, background: 'var(--color-bg-alt)' }}>
                    {e.poster_url ? (
                      <img src={e.poster_url} alt="" className="w-full h-full object-cover absolute inset-0" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs" style={{ color: 'var(--color-text-muted)' }}>No image</div>
                    )}
                    <div className="date-badge">
                      <span className="date-badge-day">{dateInfo.day}</span>
                      <span className="date-badge-month">{dateInfo.month}</span>
                    </div>
                    <span className="category-tag" style={{ bottom: 12, right: 12, left: 'auto' }}>
                      {t('upcomingEvents.upcoming')}
                    </span>
                  </div>
                  <div className="p-7 flex flex-col justify-center">
                    <h3 className="text-xl font-bold mb-3" style={{ fontFamily: "'Minecraft', sans-serif", fontWeight: 700 }}>
                      {tField(e, 'title')}
                    </h3>
                    <p className="text-sm mb-4 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                      {tField(e, 'description')}
                    </p>
                    <div className="flex items-center gap-3 text-xs mb-5" style={{ color: 'var(--color-text-muted)' }}>
                      <span className="flex items-center gap-1.5"><MapPin size={12} /> {tField(e, 'location')}</span>
                    </div>
                    <Link to="/register" className="inline-flex items-center justify-center px-5 py-2.5 rounded-2xl font-semibold text-sm transition-all duration-200"
                      style={{ background: '#0F172A', color: '#fff', alignSelf: 'flex-start' }}>
                      {t('upcomingEvents.upcoming')} <ChevronRight size={14} />
                    </Link>
                  </div>
                </div>
              </Card>
            )
          })}
          <div className="flex flex-col gap-6">
            {events.slice(1).map((e, i) => {
              const dateInfo = formatDate(e.date)
              return (
                <Card key={e.id} delay={0.1 * (i + 1)} className="flex-1">
                  <div className="flex flex-col sm:flex-row h-full">
                    <div className="card-image-overlay relative" style={{ width: '100%', height: 160, flexShrink: 0, background: 'var(--color-bg-alt)' }}>
                      {e.poster_url ? (
                        <img src={e.poster_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs" style={{ color: 'var(--color-text-muted)' }}>No image</div>
                      )}
                      <div className="date-badge" style={{ width: 50, height: 58 }}>
                        <span className="date-badge-day" style={{ fontSize: 18 }}>{dateInfo.day}</span>
                        <span className="date-badge-month">{dateInfo.month}</span>
                      </div>
                    </div>
                    <div className="p-5 flex flex-col justify-center flex-1">
                      <h3 className="font-bold text-base mb-1.5" style={{ fontFamily: "'Minecraft', sans-serif", fontWeight: 700 }}>
                        {tField(e, 'title')}
                      </h3>
                      <p className="text-xs mb-2 line-clamp-2" style={{ color: 'var(--color-text-muted)' }}>
                        {tField(e, 'description')}
                      </p>
                      <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        <MapPin size={11} /> {tField(e, 'location')}
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-30px' }} transition={spring} className="text-center mt-10">
          <Link to="/events" className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold text-sm transition-all duration-200"
            style={{ background: '#fff', color: '#0F172A', border: '2px solid #0F172A' }}>
            {t('upcomingEvents.viewAll')} <ChevronRight size={15} />
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
