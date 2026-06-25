import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, LogIn, Mail, ArrowLeft, Check } from 'lucide-react'
import useAdminStore from '../store/adminStore'
import { supabase } from '../../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState('')
  const login = useAdminStore(s => s.login)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/admin')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    setResetError('')
    setResetLoading(true)
    try {
      const check = await fetch('/api/admin/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail }),
      })
      const { exists } = await check.json()
      if (!exists) {
        throw new Error('No admin account found with this email.')
      }
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: import.meta.env.VITE_APP_URL,
      })
      if (error) throw error
      setResetSent(true)
    } catch (err) {
      setResetError(err.message || 'Failed to send reset email.')
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div dir="ltr" className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--color-bg)' }}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm rounded-2xl p-8 border shadow-sm"
        style={{ background: 'var(--color-card)', borderColor: 'var(--color-border-light)' }}
      >
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: `${'var(--color-accent)'}12` }}>
            <LogIn size={22} style={{ color: 'var(--color-accent)' }} />
          </div>
          <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--color-text)' }}>Admin Login</h1>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>AFAQ Scientific Club</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl text-sm" style={{ background: '#fef2f2', color: '#dc2626' }}>
              {error}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border text-sm"
              style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border-light)', color: 'var(--color-text)' }}
              placeholder="admin@afaq.dz"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border text-sm pr-10"
                style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border-light)', color: 'var(--color-text)' }}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="admin-icon-btn absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div className="text-right">
            <button
              type="button"
              onClick={() => { setShowReset(true); setResetEmail(email); setResetSent(false); setResetError('') }}
              className="text-xs hover:underline"
              style={{ color: 'var(--color-accent)' }}
            >
              Forgot password?
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="admin-btn-primary w-full py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: 'var(--color-accent)' }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <AnimatePresence>
          {showReset && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'fixed', inset: 0, zIndex: 9999,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(0,0,0,0.5)',
              }}
              onClick={(e) => { if (e.target === e.currentTarget) setShowReset(false) }}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-sm rounded-2xl p-8 border shadow-sm"
                style={{ background: 'var(--color-card)', borderColor: 'var(--color-border-light)', margin: 16 }}
                onClick={(e) => e.stopPropagation()}
              >
                {resetSent ? (
                  <div className="text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-4" style={{ background: 'rgba(22,163,74,0.1)' }}>
                      <Check size={22} style={{ color: '#16A34A' }} />
                    </div>
                    <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--color-text)' }}>Check your email</h2>
                    <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
                      We sent a password reset link to <strong>{resetEmail}</strong>
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowReset(false)}
                      className="text-sm font-semibold hover:underline"
                      style={{ color: 'var(--color-accent)' }}
                    >
                      Back to login
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowReset(false)}
                      className="flex items-center gap-1 text-xs mb-4 hover:underline"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      <ArrowLeft size={14} /> Back
                    </button>
                    <div className="text-center mb-6">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-4" style={{ background: `${'var(--color-accent)'}12` }}>
                        <Mail size={22} style={{ color: 'var(--color-accent)' }} />
                      </div>
                      <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--color-text)' }}>Reset Password</h2>
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        Enter your email and we'll send you a recovery link.
                      </p>
                    </div>
                    <form onSubmit={handleResetPassword} className="space-y-4">
                      {resetError && (
                        <div className="p-3 rounded-xl text-sm" style={{ background: '#fef2f2', color: '#dc2626' }}>
                          {resetError}
                        </div>
                      )}
                      <input
                        type="email"
                        value={resetEmail}
                        onChange={e => setResetEmail(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border text-sm"
                        style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border-light)', color: 'var(--color-text)' }}
                        placeholder="admin@afaq.dz"
                        required
                      />
                      <button
                        type="submit"
                        disabled={resetLoading}
                        className="admin-btn-primary w-full py-2.5 rounded-xl text-sm font-semibold text-white"
                        style={{ background: 'var(--color-accent)' }}
                      >
                        {resetLoading ? 'Sending...' : 'Send Reset Link'}
                      </button>
                    </form>
                  </>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-xs text-center mt-6" style={{ color: 'var(--color-text-muted)' }}>
          <a href="/" style={{ color: 'var(--color-accent)' }}>← Back to website</a>
        </p>
      </motion.div>
    </div>
  )
}
