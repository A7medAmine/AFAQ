import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, Calendar, ClipboardCheck, FolderGit2, Image,
  Mail, Megaphone, Shield, Settings, ChevronLeft, ChevronRight, LogOut, UserCheck, Brain,
} from 'lucide-react'
import useAdminStore from '../../store/adminStore'

const iconMap = {
  LayoutDashboard, Calendar, ClipboardCheck, FolderGit2, Image,
  Mail, Megaphone, Shield, Settings, UserCheck, Brain,
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
  { label: 'AI Knowledge', path: '/admin/ai-knowledge', icon: 'Brain', roles: ['super_admin'] },
  { label: 'Settings', path: '/admin/settings', icon: 'Settings', roles: ['super_admin'] },
]

export default function Sidebar() {
  const [hovered, setHovered] = useState(false)
  const open = useAdminStore(s => s.sidebarOpen)
  const toggle = useAdminStore(s => s.toggleSidebar)
  const role = useAdminStore(s => s.role())
  const logout = useAdminStore(s => s.logout)
  const profile = useAdminStore(s => s.adminProfile)

  const expanded = open || hovered

  const linkStyle = ({ isActive }) => ({
    background: isActive ? `${'var(--color-accent)'}12` : 'transparent',
    color: isActive ? 'var(--color-accent)' : 'var(--color-text-muted)',
  })

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Collapsed strip — always visible on desktop */}
      <aside className="hidden lg:flex flex-col h-screen fixed left-0 top-0 z-40 border-r" style={{ width: 64, background: 'var(--color-card)', borderColor: 'var(--color-border-light)' }}>
        <div className="flex items-center justify-center h-16 border-b shrink-0" style={{ borderColor: 'var(--color-border-light)' }}>
          <button onClick={toggle} className="admin-icon-btn w-9 h-9 flex items-center justify-center rounded-lg transition-all hover:scale-105" style={{ color: 'var(--color-text-muted)' }} title="Open sidebar">
            <ChevronRight size={20} />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {NAV_ITEMS.map(item => {
            if (item.roles && !item.roles.includes(role)) return null
            const Icon = iconMap[item.icon]
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/admin'}
                className="admin-nav-link flex items-center justify-center px-0 py-3 rounded-xl text-base font-medium transition-all hover:scale-105"
                style={linkStyle}
              >
                <Icon size={20} />
              </NavLink>
            )
          })}
        </nav>
        <div className="p-4 border-t shrink-0" style={{ borderColor: 'var(--color-border-light)' }}>
          <button
            onClick={logout}
            className="admin-icon-btn flex items-center justify-center w-full px-0 py-3 rounded-xl text-base font-medium transition-all hover:scale-105"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <LogOut size={20} />
          </button>
        </div>
      </aside>

      {/* Expanded overlay sidebar — slides in from left on hover or click */}
      <motion.aside
        initial={false}
        animate={{ x: expanded ? 0 : -240 }}
        transition={{ type: 'spring', damping: 24, stiffness: 260 }}
        className="fixed left-0 top-0 z-50 h-screen flex flex-col border-r"
        style={{ width: 240, background: 'var(--color-card)', borderColor: 'var(--color-border-light)' }}
      >
        <div className="flex items-center justify-end h-16 px-4 border-b shrink-0" style={{ borderColor: 'var(--color-border-light)' }}>
          <button onClick={toggle} className="admin-icon-btn w-9 h-9 flex items-center justify-center rounded-lg transition-all hover:scale-105" style={{ color: 'var(--color-text-muted)' }}>
            <ChevronLeft size={22} />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {NAV_ITEMS.map(item => {
            if (item.roles && !item.roles.includes(role)) return null
            const Icon = iconMap[item.icon]
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/admin'}
                onClick={() => { toggle(); setHovered(false) }}
                className="admin-nav-link flex items-center gap-3.5 px-4 py-3 rounded-xl text-[15px] font-medium transition-all hover:scale-[1.02]"
                style={linkStyle}
              >
                <Icon size={20} className="shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>
        <div className="p-3 border-t shrink-0" style={{ borderColor: 'var(--color-border-light)' }}>
          {profile && (
            <div className="px-4 py-2.5 mb-2 text-sm truncate" style={{ color: 'var(--color-text-muted)' }}>
              {profile.full_name || profile.email}
            </div>
          )}
          <button
            onClick={logout}
            className="admin-icon-btn flex items-center gap-3.5 w-full px-4 py-3 rounded-xl text-[15px] font-medium transition-all hover:scale-[1.02]"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <LogOut size={20} className="shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </motion.aside>
    </div>
  )
}
