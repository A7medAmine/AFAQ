import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatDay, portalRpc, signedPoints, usePortal } from '../lib/portal'

export default function PortalPoints() {
  const { t, i18n } = useTranslation('portal')
  const { me } = usePortal()
  const [entries, setEntries] = useState(null)

  useEffect(() => { portalRpc('portal_points').then(({ data }) => setEntries(data || [])) }, [])

  return (
    <div className="space-y-6">
      <div className="portal-card flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm portal-muted mb-1">{t('home.points')}</p>
          <p className="portal-stat">{me.points}</p>
        </div>
        {me.rank && (
          <p className="text-sm portal-muted">
            {t('home.clubRank')}: <strong style={{ color: 'var(--color-text)' }}>#{me.rank}</strong> / {me.ranked}
          </p>
        )}
      </div>

      <section className="portal-card">
        <h2 className="font-bold mb-3">{t('points.history')}</h2>
        {!entries ? <p className="text-sm portal-muted">{t('loading')}</p> : entries.length === 0 ? (
          <p className="text-sm portal-muted">{t('points.empty')}</p>
        ) : (
          <ul className="portal-list">
            {entries.map(e => (
              <li key={e.id} className="py-3 flex items-center gap-4">
                <span className={`portal-badge ${e.points > 0 ? 'good' : e.points < 0 ? 'bad' : 'plain'}`} style={{ minWidth: 52, justifyContent: 'center' }}>
                  {signedPoints(e.points)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{e.reason}</p>
                  <p className="text-xs portal-muted">
                    {t(`points.categories.${e.category}`, { defaultValue: e.category })}
                    {e.event_title && <> · {e.event_title}</>}
                    {' · '}{formatDay(e.created_at, i18n.language)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
