import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowUpRight, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { PlatformIcon } from '../lib/socialLinks'
import './links.css'

/**
 * The club's link-in-bio page. Posters carry a QR code to it, so it stands
 * alone (no site header or chatbot) and loads fast on a phone. Admins manage
 * the list at /admin/links; RLS only serves the links that are switched on.
 */
export default function Links() {
  const { t, i18n } = useTranslation()
  const [state, setState] = useState({ loading: true, links: [], error: false })

  useEffect(() => {
    document.title = 'AFAQ · Links'
    let cancelled = false
    supabase
      .from('social_links')
      .select('id, label, url, platform')
      .eq('is_active', true)
      .order('sort_order')
      .order('id')
      .then(({ data, error }) => {
        if (!cancelled) setState({ loading: false, links: data || [], error: !!error })
      })
    return () => { cancelled = true }
  }, [])

  return (
    <main className="lt-page" dir={i18n.dir()}>
      <div className="lt-card">
        <img className="lt-logo" src="/brand/logo/afaq-mark-navy.svg" alt="AFAQ logo" width="88" height="88" />
        <h1 className="lt-title">AFAQ</h1>
        <p className="lt-sub">{t('links.subtitle')}</p>

        {state.loading ? (
          <Loader2 className="lt-spin animate-spin" size={28} aria-label={t('links.loading')} />
        ) : state.error ? (
          <p className="lt-note">{t('links.error')}</p>
        ) : state.links.length === 0 ? (
          <p className="lt-note">{t('links.empty')}</p>
        ) : (
          <ul className="lt-list">
            {state.links.map(link => (
              <li key={link.id}>
                <a
                  className="lt-link"
                  href={link.url}
                  target={/^https?:/i.test(link.url) ? '_blank' : undefined}
                  rel="noopener noreferrer"
                >
                  <span className="lt-icon"><PlatformIcon platform={link.platform} /></span>
                  <span className="lt-label">{link.label}</span>
                  <ArrowUpRight className="lt-arrow" size={20} aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        )}

        <p className="lt-foot">{t('footer.university')}</p>
      </div>
    </main>
  )
}
