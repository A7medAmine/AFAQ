import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Eye, EyeOff, KeyRound, Check, AlertCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [invalid, setInvalid] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const hash = window.location.hash
    if (!hash.includes('type=recovery')) {
      setInvalid(true)
      return
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        setInvalid(false)
      }
    })
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setInvalid(false)
    })
    return () => subscription?.unsubscribe()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setDone(true)
      setTimeout(() => navigate('/admin/login'), 3000)
    } catch (err) {
      setError(err.message || 'Failed to reset password.')
    } finally {
      setLoading(false)
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
        {invalid ? (
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-4" style={{ background: 'rgba(239,68,68,0.1)' }}>
              <AlertCircle size={22} style={{ color: '#EF4444' }} />
            </div>
            <h1 className="text-lg font-bold mb-2" style={{ color: 'var(--color-text)' }}>Invalid or expired link</h1>
            <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
              This password reset link is invalid or has expired.
            </p>
            <button
              type="button"
              onClick={() => navigate('/admin/login')}
              className="text-sm font-semibold hover:underline"
              style={{ color: 'var(--color-accent)' }}
            >
              Back to login
            </button>
          </div>
        ) : done ? (
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-4" style={{ background: 'rgba(22,163,74,0.1)' }}>
              <Check size={22} style={{ color: '#16A34A' }} />
            </div>
            <h1 className="text-lg font-bold mb-2" style={{ color: 'var(--color-text)' }}>Password updated</h1>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Redirecting to login...
            </p>
          </div>
        ) : (
          <>
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-4" style={{ background: `${'var(--color-accent)'}12` }}>
                <KeyRound size={22} style={{ color: 'var(--color-accent)' }} />
              </div>
              <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--color-text)' }}>Set new password</h1>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Choose a strong password for your admin account.
              </p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-xl text-sm" style={{ background: '#fef2f2', color: '#dc2626' }}>
                  {error}
                </div>
              )}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>New Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border text-sm pr-10"
                    style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border-light)', color: 'var(--color-text)' }}
                    placeholder="••••••••"
                    required
                    minLength={8}
                    autoFocus
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
              <button
                type="submit"
                disabled={loading}
                className="admin-btn-primary w-full py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ background: 'var(--color-accent)' }}
              >
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </>
        )}
      </motion.div>
    </div>
  )
}
