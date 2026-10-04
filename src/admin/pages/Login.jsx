import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AlertCircle, ArrowLeft, Check, Eye, EyeOff, Mail } from 'lucide-react'
import useAdminStore from '../store/adminStore'
import { supabase } from '../../lib/supabase'
import Modal from '../components/ui/Modal'
import Button from '../components/ui/Button'
import { TextField } from '../components/ui/Field'
import '../admin.css'

export default function Login() {
  const login = useAdminStore(s => s.login)
  const theme = useAdminStore(s => s.theme)
  const authError = useAdminStore(s => s.authError)
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)

  // A suspended admin gets told why, instead of a silent bounce to this screen.
  useEffect(() => { if (authError) setError(authError) }, [authError])

  const submit = async e => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email.trim(), password)
      navigate('/admin', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      dir="ltr"
      data-theme={theme}
      className="adm adm-chassis min-h-screen flex flex-col items-center justify-center p-5"
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', damping: 26, stiffness: 300 }}
        className="w-full"
        style={{ maxWidth: 380 }}
      >
        <div className="text-center mb-7">
          <span
            className="adm-pixel inline-flex items-center justify-center mb-4"
            style={{
              width: 46, height: 46, borderRadius: 12, fontSize: 18,
              background: 'var(--adm-signal)', color: 'var(--adm-signal-ink)',
            }}
            aria-hidden="true"
          >
            A
          </span>
          <h1 className="adm-pixel text-[17px] tracking-widest mb-1.5" style={{ color: 'var(--adm-silk)' }}>
            AFAQ CONSOLE
          </h1>
          <p className="text-sm" style={{ color: 'var(--adm-silk-faint)' }}>
            Sign in to manage the scientific club.
          </p>
        </div>

        <form
          onSubmit={submit}
          className="adm-panel p-6 space-y-4"
          style={{ boxShadow: 'var(--adm-shadow-lift)' }}
        >
          {error && (
            <p
              role="alert"
              className="flex items-start gap-2 p-3 rounded-lg text-[13px]"
              style={{ background: 'var(--adm-fault-wash)', color: 'var(--adm-fault)' }}
            >
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              {error}
            </p>
          )}

          <TextField
            label="Email" type="email" required autoComplete="email"
            value={email} onChange={e => setEmail(e.target.value)}
            placeholder="admin@afaq.dz"
          />

          <div>
            <label className="adm-label" htmlFor="login-password">Password</label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                className="adm-input"
                style={{ paddingRight: 40 }}
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(s => !s)}
                className="adm-icon-btn absolute right-1 top-1/2 -translate-y-1/2"
                style={{ width: 30, height: 30 }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <Button type="submit" variant="primary" busy={loading} busyLabel="Signing in…" className="w-full">
            Sign in
          </Button>

          <button
            type="button"
            onClick={() => setResetOpen(true)}
            className="w-full text-[13px] font-medium"
            style={{ color: 'var(--adm-signal)' }}
          >
            I forgot my password
          </button>
        </form>

        <p className="text-center mt-5">
          <a href="/" className="text-[13px]" style={{ color: 'var(--adm-silk-faint)' }}>
            ← Back to the website
          </a>
        </p>
      </motion.div>

      <ResetPasswordDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        initialEmail={email}
      />
    </div>
  )
}

function ResetPasswordDialog({ open, onClose, initialEmail }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (open) { setEmail(initialEmail || ''); setSent(false); setError('') }
  }, [open, initialEmail])

  const send = async e => {
    e.preventDefault()
    setError('')
    setSending(true)
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: import.meta.env.VITE_APP_URL,
      })
      if (resetError) throw resetError
      setSent(true)
    } catch (err) {
      setError(err.message || 'The reset email could not be sent. Try again in a moment.')
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={sent ? 'Check your email' : 'Reset your password'}
      description={sent ? undefined : 'We will send a link that lets you set a new password.'}
      footer={
        sent ? (
          <Button variant="primary" onClick={onClose}>Back to sign in</Button>
        ) : (
          <>
            <Button icon={ArrowLeft} onClick={onClose} data-dialog-dismiss="true">Back</Button>
            <Button variant="primary" onClick={send} busy={sending} busyLabel="Sending…">Send the link</Button>
          </>
        )
      }
    >
      {sent ? (
        <div className="flex items-start gap-3">
          <span
            className="flex items-center justify-center rounded-lg shrink-0"
            style={{ width: 34, height: 34, background: 'var(--adm-ok-wash)', color: 'var(--adm-ok)' }}
            aria-hidden="true"
          >
            <Check size={17} />
          </span>
          <p className="text-sm" style={{ color: 'var(--adm-silk-dim)' }}>
            A reset link is on its way to <strong style={{ color: 'var(--adm-silk)' }}>{email}</strong>.
            It expires in an hour. Check your spam folder if it does not arrive.
          </p>
        </div>
      ) : (
        <form onSubmit={send} className="space-y-4">
          {error && (
            <p
              role="alert"
              className="flex items-start gap-2 p-3 rounded-lg text-[13px]"
              style={{ background: 'var(--adm-fault-wash)', color: 'var(--adm-fault)' }}
            >
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              {error}
            </p>
          )}
          <TextField
            label="Your admin email" type="email" required
            value={email} onChange={e => setEmail(e.target.value)}
            placeholder="admin@afaq.dz"
          />
          <p className="flex items-center gap-2 text-xs" style={{ color: 'var(--adm-silk-faint)' }}>
            <Mail size={13} /> Only addresses with console access can be reset here.
          </p>
        </form>
      )}
    </Modal>
  )
}
