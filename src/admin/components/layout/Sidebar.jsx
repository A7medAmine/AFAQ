import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, Calendar, ClipboardCheck, FolderGit2, Image,
  Mail, Megaphone, Shield, Settings, ChevronLeft, LogOut, UserCheck,
} from 'lucide-react'
import useAdminStore from '../../store/adminStore'

const iconMap = {
  LayoutDashboard, Calendar, ClipboardCheck, FolderGit2, Image,
  Mail, Megaphone, Shield, Settings, UserCheck,
}

const NAV_ITEMS = [
  { label: 'Overview', path: '/admin', icon: 'LayoutDashboard', roles: null },
  { label: 'Events', path: '/admin/events', icon: 'Calendar', roles: ['super_admin', 'event_manager'] },
  { label: 'Membership', path: '/admin/membership', icon: 'UserCheck', roles: ['super_admin', 'event_manager'] },
  { label: 'Event Registration', path: '/admin/registrations', icon: 'ClipboardCheck', roles: ['super_admin', 'event_manager'] },
  { label: 'Projects', path: '/admin/projects', icon: 'FolderGit2', roles: ['super_admin', 'project_manager'] },
  { label: 'Gallery', path: '/admin/gallery', icon: 'Image', roles: ['super_admin', 'media_manager'] },
  { label: 'Messages', path: '/admin/messages', icon: 'Mail', roles: null },
  { label: 'Announcements', path: '/admin/announcements', icon: 'Megaphone', roles: null },
  { label: 'Admins', path: '/admin/admins', icon: 'Shield', roles: ['super_admin'] },
  { label: 'Settings', path: '/admin/settings', icon: 'Settings', roles: ['super_admin'] },
]

export default function Sidebar() {
  const open = useAdminStore(s => s.sidebarOpen)
  const toggle = useAdminStore(s => s.toggleSidebar)
  const role = useAdminStore(s => s.role())
  const hasRole = useAdminStore(s => s.hasRole)
  const logout = useAdminStore(s => s.logout)
  const profile = useAdminStore(s => s.adminProfile)

  return (
    <motion.aside
      animate={{ width: open ? 240 : 64 }}
      className="h-screen fixed left-0 top-0 z-40 flex flex-col border-r"
      style={{ background: 'var(--color-card)', borderColor: 'var(--color-border-light)' }}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b" style={{ borderColor: 'var(--color-border-light)' }}>
        {open ? (
          <span className="text-lg font-bold" style={{ fontFamily: "'Minecraft', sans-serif", color: 'var(--color-text)' }}>
            AFAQ Admin
          </span>
        ) : (
          <span className="text-lg font-bold mx-auto" style={{ fontFamily: "'Minecraft', sans-serif", color: 'var(--color-accent)' }}>
            A
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {NAV_ITEMS.map(item => {
          if (item.roles && !item.roles.includes(role)) return null
          const Icon = iconMap[item.icon]
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/admin'}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={({ isActive }) => ({
                background: isActive ? `${'var(--color-accent)'}12` : 'transparent',
                color: isActive ? 'var(--color-accent)' : 'var(--color-text-muted)',
              })}
            >
              <Icon size={18} />
              {open && <span>{item.label}</span>}
            </NavLink>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="p-3 border-t" style={{ borderColor: 'var(--color-border-light)' }}>
        {open && profile && (
          <div className="px-3 py-2 mb-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {profile.full_name || profile.email}
          </div>
        )}
        <button
          onClick={logout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <LogOut size={18} />
          {open && <span>Logout</span>}
        </button>
      </div>
    </motion.aside>
  )
}
