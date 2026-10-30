import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { KeyRound } from 'lucide-react'
import SEO from '../../components/SEO'
import { portalSupabase, usePortal } from '../lib/portal'
import { PortalLoading } from '../PortalShell'
import PasswordForm from '../PasswordForm'
import '../portal.css'

/** Landing page of the emailed link: verify the token, then choose a password. */
export default function SetPassword() {
  const { t } = useTranslation('portal')
  const { refresh } = usePortal()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [status, setStatus] = useState('checking') // checking | ready | invalid
  // The token works once; StrictMode's second effect run must not spend it again.
  const verified = useRef(false)

  useEffect(() => {
    if (verified.current) return
    verified.current = true
    const tokenHash = params.get('token_hash')
    if (!tokenHash) { setStatus('invalid'); return }
    portalSupabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' }).then(({ error }) => {
      setStatus(error ? 'invalid' : 'ready')
      // Keep the spent token out of the history and address bar.
      window.history.replaceState(null, '', '/portal/set-password')
    })
  }, [params])

  const done = async () => {
    const member = await refresh()
    navigate(member ? '/portal' : '/portal/login', { replace: true })
  }

  if (status === 'checking') return <PortalLoading />

  return (
    <div className="portal-page">
      <SEO title={t('setPassword.title')} path="/portal/set-password" noindex />
      <div className="max-w-md mx-auto px-4">
        <div className="text-center mb-8">
          <KeyRound size={32} className="mx-auto mb-3" style={{ color: 'var(--color-accent)' }} />
          <h1 className="text-3xl font-bold mb-2">{t('setPassword.title')}</h1>
          <p className="text-sm portal-muted">{status === 'ready' ? t('setPassword.subtitle') : t('setPassword.invalid')}</p>
        </div>
        <div className="portal-card" style={{ padding: '1.75rem' }}>
          {status === 'invalid' ? (
            <div className="text-center">
              <Link to="/portal/login" className="portal-btn-primary">{t('setPassword.newLink')}</Link>
            </div>
          ) : (
            <PasswordForm submitLabel={t('setPassword.submit')} onDone={done} />
          )}
        </div>
      </div>
    </div>
  )
}
