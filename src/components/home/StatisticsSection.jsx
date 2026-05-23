import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import StatCard from '../shared/StatCard'
import SideImage from '../shared/SideImage'
import { supabase } from '../../lib/supabase'

export default function StatisticsSection() {
  const { t } = useTranslation('home')
  const [eventCount, setEventCount] = useState(null)
  const [projectCount, setProjectCount] = useState(null)
  const [memberCount, setMemberCount] = useState(null)

  useEffect(() => {
    supabase.from('events').select('*', { count: 'exact', head: true }).eq('is_published', true)
      .then(({ count }) => setEventCount(count || 0))
    supabase.from('projects').select('*', { count: 'exact', head: true }).eq('is_published', true)
      .then(({ count }) => setProjectCount(count || 0))
    supabase.from('event_registrations').select('*', { count: 'exact', head: true }).eq('status', 'approved')
      .then(({ count }) => setMemberCount(count || 0))
  }, [])

  const stats = ['members', 'projects', 'events', 'workshops']

  return (
    <section className="py-16 md:py-20 relative z-0" style={{ background: '#F1F5F9' }}>
      <SideImage side="left" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="eyebrow eyebrow-center mb-4">{t('stats.title')}</div>
          <h2 className="text-3xl md:text-4xl font-bold">{t('stats.title')}</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((s, i) => {
            let value = null
            if (s === 'events') value = eventCount !== null ? `${eventCount}+` : null
            else if (s === 'projects') value = projectCount !== null ? `${projectCount}+` : null
            else if (s === 'members') value = memberCount !== null ? `${memberCount}+` : null
            return (
              <StatCard
                key={s}
                value={value || t(`stats.${s}.value`)}
                label={t(`stats.${s}.label`)}
                delay={i * 0.1}
              />
            )
          })}
        </div>
      </div>
    </section>
  )
}
