import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Check, AlertCircle } from 'lucide-react'
import useAdminStore from '../store/adminStore'

export default function SettingsPage() {
  const adminProfile = useAdminStore(s => s.adminProfile)
  const addToast = useAdminStore(s => s.addToast)

  const [fullName, setFullName] = useState('')
  const [saving, setSaving] = useState(false)
  const [profileErr, setProfileErr] = useState('')
  const [profileOk, setProfileOk] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [passwordErr, setPasswordErr] = useState('')
  const [passwordOk, setPasswordOk] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)

  useEffect(() => {
    if (adminProfile?.full_name) setFullName(adminProfile.full_name)
  }, [adminProfile])

  const handleProfileSubmit = async (e) => {
    e.preventDefault()
    if (!fullName.trim()) return
    setSaving(true)
    setProfileErr('')
    setProfileOk(false)
    try {
      const token = (await import('../../lib/supabase')).supabase.auth.getSession().then(({ data: { session } }) => session?.access_token)
      const res = await fetch('/api/admin/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await token}`,
        },
        body: JSON.stringify({ full_name: fullName.trim() }),
      })
      if (!res.ok) {
        const { error } = await res.json()
        throw new Error(error || 'Failed to update profile')
      }
      const { profile } = await res.json()
      useAdminStore.setState({ adminProfile: profile })
      setProfileOk(true)
      addToast('Profile updated successfully')
    } catch (err) {
      setProfileErr(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordSubmit = async (e) => {
    e.preventDefault()
    if (!currentPassword) {
      setPasswordErr('Current password is required.')
      return
    }
    if (newPassword.length < 8) {
      setPasswordErr('New password must be at least 8 characters.')
      return
    }
    setChangingPassword(true)
    setPasswordErr('')
    setPasswordOk(false)
    try {
      const token = (await import('../../lib/supabase')).supabase.auth.getSession().then(({ data: { session } }) => session?.access_token)
      const res = await fetch('/api/admin/password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await token}`,
        },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      })
      if (!res.ok) {
        const { error } = await res.json()
        throw new Error(error || 'Failed to update password')
      }
      setCurrentPassword('')
      setNewPassword('')
      setPasswordOk(true)
      addToast('Password updated successfully')
    } catch (err) {
      setPasswordErr(err.message)
    } finally {
      setChangingPassword(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>Admin settings</p>

      <div className="space-y-6 max-w-2xl">
        {/* Profile */}
        <div className="rounded-2xl border p-5" style={{ background: 'var(--color-card)', borderColor: 'var(--color-border-light)' }}>
          <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--color-text)' }}>Profile</h2>
          <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>{adminProfile?.email}</p>

          <form onSubmit={handleProfileSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={e => { setFullName(e.target.value); setProfileOk(false) }}
                className="w-full px-3 py-2 rounded-xl border text-sm"
                style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border-light)', color: 'var(--color-text)' }}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Email</label>
              <p className="text-sm py-2" style={{ color: 'var(--color-text-muted)' }}>{adminProfile?.email}</p>
            </div>
            {profileErr && (
              <div className="flex items-center gap-2 text-xs" style={{ color: '#dc2626' }}>
                <AlertCircle size={14} /> {profileErr}
              </div>
            )}
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={saving || !fullName.trim()}
                className="admin-btn-primary px-4 py-2 rounded-xl text-sm font-semibold text-white"
                style={{ background: 'var(--color-accent)' }}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              {profileOk && (
                <span className="flex items-center gap-1 text-xs" style={{ color: '#16A34A' }}>
                  <Check size={14} /> Saved
                </span>
              )}
            </div>
          </form>
        </div>

        {/* Password */}
        <div className="rounded-2xl border p-5" style={{ background: 'var(--color-card)', borderColor: 'var(--color-border-light)' }}>
          <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--color-text)' }}>Change Password</h2>
          <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>Set a new password for your account.</p>

          <form onSubmit={handlePasswordSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Current Password</label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={e => { setCurrentPassword(e.target.value); setPasswordOk(false) }}
                  className="w-full px-3 py-2 rounded-xl border text-sm pr-10"
                  style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border-light)', color: 'var(--color-text)' }}
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="admin-icon-btn absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>New Password</label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => { setNewPassword(e.target.value); setPasswordOk(false) }}
                  className="w-full px-3 py-2 rounded-xl border text-sm pr-10"
                  style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border-light)', color: 'var(--color-text)' }}
                  placeholder="••••••••"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="admin-icon-btn absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {passwordErr && (
              <div className="flex items-center gap-2 text-xs" style={{ color: '#dc2626' }}>
                <AlertCircle size={14} /> {passwordErr}
              </div>
            )}
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={changingPassword || !currentPassword || newPassword.length < 8}
                className="admin-btn-primary px-4 py-2 rounded-xl text-sm font-semibold text-white"
                style={{ background: 'var(--color-accent)' }}
              >
                {changingPassword ? 'Updating...' : 'Update Password'}
              </button>
              {passwordOk && (
                <span className="flex items-center gap-1 text-xs" style={{ color: '#16A34A' }}>
                  <Check size={14} /> Password updated
                </span>
              )}
            </div>
          </form>
        </div>

        {/* Role info */}
        <div className="rounded-2xl border p-5" style={{ background: 'var(--color-card)', borderColor: 'var(--color-border-light)' }}>
          <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--color-text)' }}>Role</h2>
          <p className="text-sm" style={{ color: 'var(--color-text)' }}>{adminProfile?.role?.label || '—'}</p>
        </div>
      </div>
    </motion.div>
  )
}
