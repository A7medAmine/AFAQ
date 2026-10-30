import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pin } from 'lucide-react'
import { formatDay, portalRpc } from '../lib/portal'

export default function PortalNotices() {
  const { t, i18n } = useTranslation('portal')
  const [notices, setNotices] = useState(null)

  useEffect(() => {
    portalRpc('portal_notices').then(({ data }) => {
      const list = data || []
      setNotices(list)
      // Opening the page counts as reading them; the dots stay for this visit.
      const unread = list.filter(n => !n.is_read).map(n => n.id)
      if (unread.length) portalRpc('portal_read_notices', { p_ids: unread })
    })
  }, [])

  if (!notices) return <p className="text-sm portal-muted">{t('loading')}</p>
  if (!notices.length) return <div className="portal-card"><p className="text-sm portal-muted">{t('notices.empty')}</p></div>

  return (
    <ul className="space-y-4">
      {notices.map(n => (
        <li key={n.id} className="portal-card" style={n.priority === 'important' ? { borderColor: 'var(--color-warning)' } : undefined}>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            {!n.is_read && <span className="w-2 h-2 rounded-full" style={{ background: 'var(--color-accent)' }} aria-label={t('notices.new')} />}
            <h3 className="font-bold">{n.title}</h3>
            {n.is_pinned && <span className="portal-badge plain"><Pin size={11} /> {t('notices.pinned')}</span>}
            {n.priority === 'important' && <span className="portal-badge warn">{t('notices.important')}</span>}
          </div>
          <p className="text-xs portal-muted mb-3">{formatDay(n.created_at, i18n.language, true)}</p>
          <p className="text-sm whitespace-pre-line leading-relaxed">{n.body}</p>
        </li>
      ))}
    </ul>
  )
}
