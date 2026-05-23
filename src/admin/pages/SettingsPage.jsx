import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import useAdminStore from '../store/adminStore'

export default function SettingsPage() {
  const adminProfile = useAdminStore(s => s.adminProfile)
  const navigate = useNavigate()

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>Admin settings</p>

      <div className="rounded-2xl border p-5 max-w-2xl" style={{ background: 'var(--color-card)', borderColor: 'var(--color-border-light)' }}>
        <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--color-text)' }}>Profile</h2>
        <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>{adminProfile?.email}</p>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Full Name</label>
            <p className="text-sm" style={{ color: 'var(--color-text)' }}>{adminProfile?.full_name || '—'}</p>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Role</label>
            <p className="text-sm" style={{ color: 'var(--color-text)' }}>{adminProfile?.role?.label || '—'}</p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
