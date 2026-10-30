import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarCheck, MapPin } from 'lucide-react'
import { formatDay, localized, portalRpc } from '../lib/portal'

const STATUS_TONE = { approved: 'good', pending: 'warn', rejected: 'bad', cancelled: 'plain' }

export default function PortalEvents() {
  const { t, i18n } = useTranslation('portal')
  const lang = i18n.language
  const [events, setEvents] = useState(null)
  const [busy, setBusy] = useState(null)
  const [message, setMessage] = useState(null)

  const load = useCallback(() => portalRpc('portal_events').then(({ data }) => setEvents(data || [])), [])
  useEffect(() => { load() }, [load])

  const register = async event => {
    setBusy(event.id)
    setMessage(null)
    const { data, error } = await portalRpc('portal_register_event', { p_event_id: event.id })
    setBusy(null)
    const result = error ? 'failed' : data
    setMessage({ ok: result === 'ok', text: t(`events.result.${result}`, { defaultValue: t('events.result.failed') }) })
    load()
  }

  const today = new Date().toISOString().slice(0, 10)
  const upcoming = events?.filter(e => e.date >= today) || []
  const past = events?.filter(e => e.date < today) || []

  const card = e => {
    const isUpcoming = e.date >= today
    return (
      <li key={e.id} className="portal-card flex flex-col sm:flex-row gap-4">
        {e.poster_url && (
          <img src={e.poster_url} alt="" loading="lazy" className="w-full sm:w-40 rounded-xl object-cover" style={{ aspectRatio: '16/9' }} />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="font-bold">{localized(e, 'title', lang)}</h3>
            {e.registration_status && (
              <span className={`portal-badge ${STATUS_TONE[e.registration_status] || 'plain'}`}>
                {t(`events.status.${e.registration_status}`, { defaultValue: e.registration_status })}
              </span>
            )}
          </div>
          <p className="text-sm portal-muted flex flex-wrap gap-x-3">
            <span>{formatDay(e.date, lang)}{e.time && ` · ${e.time.slice(0, 5)}`}</span>
            {localized(e, 'location', lang) && <span className="inline-flex items-center gap-1"><MapPin size={12} /> {localized(e, 'location', lang)}</span>}
          </p>
          {localized(e, 'description', lang) && (
            <p className="text-sm mt-2 line-clamp-3 portal-muted">{localized(e, 'description', lang)}</p>
          )}
          {isUpcoming && !e.registration_status && (
            <div className="mt-3">
              {e.is_full ? <span className="portal-badge plain">{t('events.full')}</span>
                : !e.registration_open ? <span className="portal-badge plain">{t('events.closed')}</span>
                : (
                  <button type="button" className="portal-btn-primary" disabled={busy === e.id} onClick={() => register(e)}>
                    <CalendarCheck size={15} /> {busy === e.id ? t('login.wait') : t('events.register')}
                  </button>
                )}
            </div>
          )}
        </div>
      </li>
    )
  }

  if (!events) return <p className="text-sm portal-muted">{t('loading')}</p>

  return (
    <div className="space-y-6">
      {message && <div className={`portal-alert ${message.ok ? '' : 'error'}`} role="status">{message.text}</div>}
      <section>
        <h2 className="font-bold mb-3">{t('events.upcoming')}</h2>
        {upcoming.length === 0 ? <p className="text-sm portal-muted">{t('events.empty')}</p> : <ul className="space-y-4">{upcoming.map(card)}</ul>}
      </section>
      {past.length > 0 && (
        <section>
          <h2 className="font-bold mb-3">{t('events.attended')}</h2>
          <ul className="space-y-4">{past.map(card)}</ul>
        </section>
      )}
    </div>
  )
}
