import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff, LogIn, MailCheck, Send } from 'lucide-react'
import SEO from '../../components/SEO'
import { usePortal } from '../lib/portal'
import { PortalLoading } from '../PortalShell'
import '../portal.css'

/** Sign in, or ask for a link to set a password (first time / forgotten). */
export default function PortalLogin() {
  const { t } = useTranslation('portal')
  const { me, signIn } = usePortal()
  const navigate = useNavigate()
  const { state } = useLocation()
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [sent, setSent] = useState(false)

  if (me === undefined) return <PortalLoading />
  if (me) return <Navigate to={state?.from || '/portal'} replace />

  const submit = async e => {
    e.preventDefault()
    setError(null)
    if (!email.trim()) { setError(t('login.errors.email')); return }
    setBusy(true)
    if (mode === 'signin') {
      const result = await signIn(email, password)
      setBusy(false)
      if (result.ok) navigate(state?.from || '/portal', { replace: true })
      else setError(t(`login.errors.${result.error}`))
      return
    }
    try {
      const res = await fetch('/api/portal/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (res.status === 429) setError(t('login.errors.tooMany'))
      else if (!res.ok) setError(t('login.errors.email'))
      else setSent(true)
    } catch {
      setError(t('login.errors.network'))
    }
    setBusy(false)
  }

  const switchMode = next => { setMode(next); setError(null); setSent(false) }

  return (
    <div className="portal-page">
      <SEO title={t('login.title')} path="/portal/login" noindex />
      <div className="max-w-md mx-auto px-4">
        <div className="text-center mb-8">
          <div className="eyebrow eyebrow-center mb-3">{t('title')}</div>
          <h1 className="text-3xl font-bold mb-2">{mode === 'signin' ? t('login.title') : t('login.accessTitle')}</h1>
          <p className="text-sm portal-muted">{mode === 'signin' ? t('login.subtitle') : t('login.accessSubtitle')}</p>
        </div>

        <div className="portal-card" style={{ padding: '1.75rem' }}>
          {sent ? (
            <div className="text-center">
              <MailCheck size={36} className="mx-auto mb-3" style={{ color: 'var(--color-accent)' }} />
              <p className="font-semibold mb-1">{t('login.sentTitle')}</p>
              <p className="text-sm portal-muted mb-5">{t('login.sentText', { email })}</p>
              <button type="button" className="portal-btn" onClick={() => switchMode('signin')}>{t('login.back')}</button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4" noValidate>
              <div>
                <label className="portal-label" htmlFor="portal-email">{t('login.email')}</label>
                <input id="portal-email" type="email" autoComplete="email" className="portal-input" dir="ltr"
                  value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              {mode === 'signin' && (
                <div>
                  <label className="portal-label" htmlFor="portal-password">{t('login.password')}</label>
                  <div className="relative">
                    <input id="portal-password" type={show ? 'text' : 'password'} autoComplete="current-password" className="portal-input" dir="ltr"
                      style={{ paddingInlineEnd: '2.75rem' }} value={password} onChange={e => setPassword(e.target.value)} />
                    <button type="button" onClick={() => setShow(s => !s)} aria-label={t(show ? 'login.hide' : 'login.show')}
                      className="absolute top-1/2 -translate-y-1/2 portal-muted" style={{ insetInlineEnd: '0.8rem' }}>
                      {show ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              )}
              {error && <div className="portal-alert error" role="alert">{error}</div>}
              <button type="submit" className="portal-btn-primary w-full" disabled={busy}>
                {mode === 'signin' ? <LogIn size={16} /> : <Send size={16} />}
                {busy ? t('login.wait') : mode === 'signin' ? t('login.submit') : t('login.sendLink')}
              </button>
              <p className="text-center text-sm">
                {mode === 'signin' ? (
                  <button type="button" className="font-semibold" style={{ color: 'var(--color-accent)' }} onClick={() => switchMode('access')}>
                    {t('login.firstTime')}
                  </button>
                ) : (
                  <button type="button" className="font-semibold" style={{ color: 'var(--color-accent)' }} onClick={() => switchMode('signin')}>
                    {t('login.back')}
                  </button>
                )}
              </p>
            </form>
          )}
        </div>
        <p className="text-center text-xs portal-muted mt-4">{t('login.membersOnly')}</p>
      </div>
    </div>
  )
}
