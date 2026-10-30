import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff } from 'lucide-react'
import { changePassword } from './lib/portal'

/** New password + confirmation, saved through the server. Used after a link, a temporary password, or from the profile. */
export default function PasswordForm({ submitLabel, onDone }) {
  const { t } = useTranslation('portal')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async e => {
    e.preventDefault()
    if (password.length < 8) { setError('short'); return }
    if (password.length > 72) { setError('long'); return }
    if (password !== confirm) { setError('mismatch'); return }
    setError(null)
    setBusy(true)
    const problem = await changePassword(password)
    setBusy(false)
    if (problem) { setError(problem); return }
    setPassword('')
    setConfirm('')
    onDone?.()
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <label className="portal-label" htmlFor="new-password">{t('setPassword.password')}</label>
        <div className="relative">
          <input id="new-password" type={show ? 'text' : 'password'} autoComplete="new-password" className="portal-input" dir="ltr"
            style={{ paddingInlineEnd: '2.75rem' }} value={password} onChange={e => setPassword(e.target.value)} />
          <button type="button" onClick={() => setShow(s => !s)} aria-label={t(show ? 'login.hide' : 'login.show')}
            className="absolute top-1/2 -translate-y-1/2 portal-muted" style={{ insetInlineEnd: '0.8rem' }}>
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <p className="text-xs portal-muted mt-1">{t('setPassword.hint')}</p>
      </div>
      <div>
        <label className="portal-label" htmlFor="confirm-password">{t('setPassword.confirm')}</label>
        <input id="confirm-password" type={show ? 'text' : 'password'} autoComplete="new-password" className="portal-input" dir="ltr"
          value={confirm} onChange={e => setConfirm(e.target.value)} />
      </div>
      {error && <div className="portal-alert error" role="alert">{t(`setPassword.errors.${error}`)}</div>}
      <button type="submit" className="portal-btn-primary w-full" disabled={busy}>
        {busy ? t('login.wait') : submitLabel}
      </button>
    </form>
  )
}
