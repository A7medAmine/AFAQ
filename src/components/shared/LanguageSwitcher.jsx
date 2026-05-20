import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Globe, Check } from 'lucide-react'

const languages = [
  { code: 'en', label: 'EN', flag: '🇬🇧' },
  { code: 'fr', label: 'FR', flag: '🇫🇷' },
  { code: 'ar', label: 'AR', flag: '🇩🇿' },
]

export default function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const current = languages.find(l => l.code === i18n.language) || languages[0]

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const switchLang = (code) => {
    i18n.changeLanguage(code)
    document.documentElement.dir = code === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = code
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer"
        style={{ background: 'var(--color-bg-alt)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
      >
        <Globe size={16} />
      </button>
      {open && (
        <div
          className="absolute top-full mt-2 right-0 overflow-hidden z-50 animate-up"
          style={{
            background: 'var(--color-card)',
            border: '1px solid var(--color-border-light)',
            borderRadius: 13,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            minWidth: 140,
          }}
        >
          {languages.map(l => (
            <button
              key={l.code}
              onClick={() => switchLang(l.code)}
              className="w-full text-left px-4 py-2.5 flex items-center gap-2 transition-colors"
              style={{
                fontSize: 14,
                color: l.code === i18n.language ? 'var(--color-accent)' : 'var(--color-text)',
                fontWeight: l.code === i18n.language ? 600 : 400,
              }}
              onMouseEnter={e => e.target.style.background = 'var(--color-bg-alt)'}
              onMouseLeave={e => e.target.style.background = 'transparent'}
            >
              <span>{l.flag}</span>
              <span style={{ flex: 1 }}>{l.code === 'ar' ? 'العربية' : l.code === 'fr' ? 'Français' : 'English'}</span>
              {l.code === i18n.language && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
