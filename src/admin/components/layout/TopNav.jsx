import useAdminStore from '../../store/adminStore'

export default function TopNav() {
  const profile = useAdminStore(s => s.adminProfile)

  return (
    <header
      className="h-16 fixed top-0 right-0 left-0 z-30 flex items-center justify-end px-6 border-b"
      style={{
        background: 'var(--color-card)',
        borderColor: 'var(--color-border-light)',
      }}
      id="admin-topnav"
    >
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-base font-medium" style={{ color: 'var(--color-text)' }}>{profile?.full_name || 'Admin'}</p>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{profile?.role?.label || ''}</p>
        </div>
        {profile?.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={profile.full_name || 'Admin'}
            className="w-10 h-10 rounded-full object-cover border-2"
            style={{ borderColor: 'var(--color-accent-soft)' }}
          />
        ) : (
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
            style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}
          >
            {(profile?.full_name || 'A').charAt(0).toUpperCase()}
          </div>
        )}
      </div>
    </header>
  )
}
