import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Bell, CalendarDays, ListChecks, Trophy } from 'lucide-react'
import { formatDay, localized, portalRpc, usePortal } from '../lib/portal'

function Section({ title, to, icon: Icon, children }) {
  const { t } = useTranslation('portal')
  return (
    <section className="portal-card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold flex items-center gap-2"><Icon size={17} style={{ color: 'var(--color-accent)' }} /> {title}</h2>
        <Link to={to} className="text-sm font-semibold inline-flex items-center gap-1" style={{ color: 'var(--color-accent)' }}>
          {t('seeAll')} <ArrowRight size={14} className="rtl:rotate-180" />
        </Link>
      </div>
      {children}
    </section>
  )
}

export default function PortalHome() {
  const { t, i18n } = useTranslation('portal')
  const { me } = usePortal()
  const [data, setData] = useState(null)

  useEffect(() => {
    Promise.all([portalRpc('portal_notices'), portalRpc('portal_events'), portalRpc('portal_tasks')])
      .then(([notices, events, tasks]) => setData({
        notices: notices.data || [],
        events: (events.data || []).filter(e => e.date >= new Date().toISOString().slice(0, 10)),
        tasks: (tasks.data || []).filter(task => task.status !== 'done'),
      }))
  }, [])

  const unread = data?.notices.filter(n => !n.is_read).length || 0

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="portal-card">
          <p className="text-sm portal-muted mb-1">{t('home.points')}</p>
          <p className="portal-stat">{me.points}</p>
        </div>
        <div className="portal-card">
          <p className="text-sm portal-muted mb-1">{t('home.clubRank')}</p>
          <p className="portal-stat">{me.rank ? `#${me.rank}` : '—'}</p>
          {me.rank && <p className="text-xs portal-muted mt-1">{t('home.outOf', { count: me.ranked })}</p>}
        </div>
        <div className="portal-card">
          <p className="text-sm portal-muted mb-1">{t('home.departmentRank')}</p>
          {me.departments.length && me.rank ? (
            <div className="space-y-1">
              {me.departments.map(d => (
                <p key={d.id} className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold truncate">{d.name}</span>
                  <span className="text-sm"><strong className="text-lg">#{d.rank}</strong> <span className="portal-muted">/ {d.size}</span></span>
                </p>
              ))}
            </div>
          ) : <p className="portal-stat">—</p>}
        </div>
      </div>

      <Section title={unread ? t('home.noticesUnread', { count: unread }) : t('tabs.notices')} to="/portal/notices" icon={Bell}>
        {!data ? <p className="text-sm portal-muted">{t('loading')}</p> : data.notices.length === 0 ? (
          <p className="text-sm portal-muted">{t('notices.empty')}</p>
        ) : (
          <ul className="portal-list">
            {data.notices.slice(0, 3).map(n => (
              <li key={n.id} className="py-2.5 flex items-start gap-3">
                {!n.is_read && <span className="mt-2 w-2 h-2 rounded-full shrink-0" style={{ background: 'var(--color-accent)' }} />}
                <div className="min-w-0">
                  <p className={`truncate ${n.is_read ? '' : 'font-semibold'}`}>{n.title}</p>
                  <p className="text-xs portal-muted">{formatDay(n.created_at, i18n.language)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Section title={t('home.nextEvents')} to="/portal/events" icon={CalendarDays}>
          {!data ? <p className="text-sm portal-muted">{t('loading')}</p> : data.events.length === 0 ? (
            <p className="text-sm portal-muted">{t('events.empty')}</p>
          ) : (
            <ul className="portal-list">
              {data.events.slice(0, 3).map(e => (
                <li key={e.id} className="py-2.5">
                  <p className="font-semibold truncate">{localized(e, 'title', i18n.language)}</p>
                  <p className="text-xs portal-muted">
                    {formatDay(e.date, i18n.language)}
                    {e.registration_status && <> · {t(`events.status.${e.registration_status}`, { defaultValue: e.registration_status })}</>}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title={t('home.openTasks')} to="/portal/tasks" icon={ListChecks}>
          {!data ? <p className="text-sm portal-muted">{t('loading')}</p> : data.tasks.length === 0 ? (
            <p className="text-sm portal-muted">{t('tasks.empty')}</p>
          ) : (
            <ul className="portal-list">
              {data.tasks.slice(0, 3).map(task => (
                <li key={task.id} className="py-2.5">
                  <p className="font-semibold truncate">{task.title}</p>
                  {task.due_date && <p className="text-xs portal-muted">{t('tasks.due', { date: formatDay(task.due_date, i18n.language) })}</p>}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <p className="text-xs portal-muted flex items-center gap-1.5">
        <Trophy size={13} /> {t('home.rankNote')}
      </p>
    </div>
  )
}
