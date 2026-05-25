import { Menu } from 'lucide-react'
import useAdminStore from '../../store/adminStore'

export default function TopNav({ title }) {
  const toggleSidebar = useAdminStore(s => s.toggleSidebar)
  const profile = useAdminStore(s => s.adminProfile)

  return (
    <header
      className="h-16 fixed top-0 right-0 left-0 z-30 flex items-center justify-between px-6 border-b"
      style={{
        background: 'var(--color-card)',
        borderColor: 'var(--color-border-light)',
      }}
      id="admin-topnav"
    >
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <Menu size={18} />
        </button>
        <h1 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{profile?.full_name || 'Admin'}</p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{profile?.role?.label || ''}</p>
        </div>
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
          style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}
        >
          {(profile?.full_name || 'A').charAt(0).toUpperCase()}
        </div>
      </div>
    </header>
  )
}
