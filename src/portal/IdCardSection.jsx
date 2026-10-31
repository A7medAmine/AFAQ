import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Download, FileText, Maximize2, RotateCw, X } from 'lucide-react'
import { CARD_THEMES, downloadPdf, downloadPng, renderIdCard, themeSwatch } from './lib/idCard'
import { usePortal } from './lib/portal'

const initials = name => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()

// The look is a personal choice, so it is kept on this device only.
const STORE = 'afaq.portal.card'
const readChoice = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || '{}')
    return {
      theme: CARD_THEMES[saved.theme] ? saved.theme : 'blue',
      layout: saved.layout === 'single' ? 'single' : 'double',
    }
  } catch {
    return { theme: 'blue', layout: 'double' }
  }
}

/** Digital member card: theme and layout, preview, PNG / PDF download, and a full-screen view for scanning. */
export default function IdCardSection() {
  const { t, i18n } = useTranslation('portal')
  const { me } = usePortal()
  const [choice, setChoice] = useState(readChoice)
  const [card, setCard] = useState(null) // { sides: [canvas], urls: [dataUrl] }
  const [side, setSide] = useState(0)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(false)
  const [showing, setShowing] = useState(false)

  const choose = patch => {
    const next = { ...choice, ...patch }
    setChoice(next)
    setSide(0)
    try { localStorage.setItem(STORE, JSON.stringify(next)) } catch { /* private mode */ }
  }

  // The card itself stays in English, like the printed one; only roles are translated to it.
  const member = useMemo(() => {
    const en = i18n.getFixedT('en', 'portal')
    const today = new Date().toISOString().slice(0, 10)
    const positions = me.positions.filter(p => !p.term_end || p.term_end >= today)
    const valid = me.status === 'active' && (me.card_status || 'active') === 'active'
    return {
      full_name: me.full_name,
      member_code: me.member_code,
      initials: initials(me.full_name),
      photo_url: me.photo_url,
      role: positions.length
        ? positions.map(p => en(`positions.${p.title}`, { defaultValue: p.title })).join(' · ')
        : me.departments.map(d => d.name).join(' · '),
      valid,
      statusLabel: (me.card_status && me.card_status !== 'active')
        ? en(`profile.cardStatuses.${me.card_status}`, { defaultValue: me.card_status })
        : en(`profile.statuses.${me.status}`, { defaultValue: me.status }),
      verifyUrl: `${window.location.origin}/verify/${me.member_code}`,
    }
  }, [me, i18n])

  useEffect(() => {
    let cancelled = false
    setError(false)
    renderIdCard(member, choice)
      .then(({ sides }) => {
        if (!cancelled) setCard({ sides, urls: sides.map(s => s.toDataURL('image/png')) })
      })
      .catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
  }, [member, choice])

  const run = async (kind, fn) => {
    setBusy(kind)
    try { await fn(card, me.member_code) } catch { setError(true) }
    setBusy(null)
  }

  const twoSided = card?.sides.length === 2
  // The face with the barcode: the back of a two-sided card, the only face otherwise.
  const codeUrl = card?.urls[card.urls.length - 1]

  return (
    <section className="portal-card lg:sticky" style={{ top: 'calc(var(--nav-h) + 1rem)' }}>
      <h2 className="font-bold mb-3 text-center">{t('profile.card')}</h2>

      {!card ? (
        <div className="rounded-xl" style={{ aspectRatio: '85.6 / 54', background: 'var(--color-bg-alt)', animation: 'shimmer 1.5s ease-in-out infinite' }} />
      ) : twoSided ? (
        <button type="button" onClick={() => setSide(s => 1 - s)} className="block w-full relative" aria-label={t('card.flip')}>
          <img src={card.urls[side]} alt={t('profile.qrAlt')} className="w-full rounded-xl shadow-md" style={{ aspectRatio: '85.6 / 54' }} />
          <span className="absolute bottom-2 right-2 portal-badge plain opacity-80"><RotateCw size={11} /> {t('card.flip')}</span>
        </button>
      ) : (
        <img src={card.urls[0]} alt={t('profile.qrAlt')} className="w-full rounded-xl shadow-md" style={{ aspectRatio: '85.6 / 54' }} />
      )}

      {error && <div className="portal-alert error mt-3" role="alert">{t('card.error')}</div>}
      {!member.valid && <div className="portal-alert error mt-3">{t('card.notValid')}</div>}

      <div className="mt-4 space-y-3">
        <div>
          <p className="portal-label">{t('card.layout')}</p>
          <div className="grid grid-cols-2 gap-1 p-1 rounded-full" style={{ background: 'var(--color-bg-alt)' }} role="radiogroup" aria-label={t('card.layout')}>
            {['double', 'single'].map(value => (
              <button key={value} type="button" role="radio" aria-checked={choice.layout === value}
                onClick={() => choose({ layout: value })}
                className="rounded-full py-1.5 text-sm font-semibold transition-colors"
                style={choice.layout === value ? { background: 'var(--color-card)', color: 'var(--color-accent)', boxShadow: '0 1px 3px rgba(0,0,0,.1)' } : { color: 'var(--color-text-muted)' }}>
                {t(`card.layouts.${value}`)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="portal-label">{t('card.theme')}</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('card.theme')}>
            {Object.entries(CARD_THEMES).map(([key, theme]) => (
              <button key={key} type="button" role="radio" aria-checked={choice.theme === key}
                aria-label={t(`card.themes.${key}`)} title={t(`card.themes.${key}`)}
                onClick={() => choose({ theme: key })}
                className="w-9 h-9 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                style={{
                  background: themeSwatch(theme),
                  boxShadow: choice.theme === key ? `0 0 0 2px var(--color-card), 0 0 0 4px ${theme.accent}` : 'inset 0 0 0 1px rgba(0,0,0,.15)',
                }}>
                {choice.theme === key && <Check size={16} color={theme.ink} />}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 mt-4">
        <button type="button" className="portal-btn-primary" disabled={!card || !!busy} onClick={() => run('png', downloadPng)}>
          <Download size={15} /> {busy === 'png' ? t('login.wait') : t('card.downloadImage')}
        </button>
        <button type="button" className="portal-btn" disabled={!card || !!busy} onClick={() => run('pdf', downloadPdf)}>
          <FileText size={15} /> {busy === 'pdf' ? t('login.wait') : t('card.downloadPdf')}
        </button>
        <button type="button" className="portal-btn" disabled={!card} onClick={() => setShowing(true)}>
          <Maximize2 size={15} /> {t('card.show')}
        </button>
      </div>
      <p className="text-xs portal-muted mt-3 text-center">{t('card.note')}</p>

      {showing && codeUrl && (
        // Full screen on white so a scanner reads the barcode straight off the phone.
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 p-4" style={{ background: '#fff' }}
          role="dialog" aria-modal="true" aria-label={t('card.show')} onClick={() => setShowing(false)}>
          <button type="button" className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: '#F1F5F9', color: '#050A30' }} aria-label={t('card.close')}>
            <X size={20} />
          </button>
          <img src={codeUrl} alt="" className="w-full max-w-xl rounded-2xl shadow-lg" />
          <p className="text-sm text-center" style={{ color: '#475569' }}>{t('card.showHint')}</p>
        </div>
      )}
    </section>
  )
}
