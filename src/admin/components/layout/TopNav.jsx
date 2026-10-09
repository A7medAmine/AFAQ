import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ExternalLink, LogOut, Menu, Monitor, Moon, Search, SlidersHorizontal, Sun,
} from 'lucide-react'
import useAdminStore from '../../store/adminStore'
import { navItemForPath } from '../../lib/permissions'
import { initials } from '../../lib/format'

const THEMES = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

function ThemeToggle() {
  const theme = useAdminStore(s => s.theme)
  const setTheme = useAdminStore(s => s.setTheme)
  const current = THEMES.find(t => t.value === theme) || THEMES[2]
  const next = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length]
  const Icon = current.icon

  return (
    <button
      type="button"
      onClick={() => setTheme(next.value)}
      className="adm-icon-btn"
      aria-label={`Appearance: ${current.label}. Switch to ${next.label}`}
      title={`Appearance: ${current.label}`}
    >
      <Icon size={17} />
    </button>
  )
}

function UserMenu() {
  const profile = useAdminStore(s => s.adminProfile)
  const logout = useAdminStore(s => s.logout)
  const isSuperAdmin = useAdminStore(s => s.isSuperAdmin())
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    const onPointerDown = e => { if (!ref.current?.contains(e.target)) setOpen(false) }
    const onKey = e => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const signOut = async () => {
    await logout()
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2.5 pl-1.5 pr-2 h-10 rounded-xl transition-colors"
        style={{ background: open ? 'var(--adm-board-sunk)' : 'transparent' }}
      >
        {profile?.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt=""
            className="rounded-lg object-cover"
            style={{ width: 30, height: 30 }}
          />
        ) : (
          <span
            className="adm-pixel flex items-center justify-center rounded-lg text-[11px]"
            style={{ width: 30, height: 30, background: 'var(--adm-signal-wash)', color: 'var(--adm-signal)' }}
            aria-hidden="true"
          >
            {initials(profile?.full_name || profile?.email)}
          </span>
        )}
        <span className="hidden sm:block text-left leading-tight max-w-[150px]">
          <span className="block text-[13px] font-semibold adm-truncate" style={{ color: 'var(--adm-silk)' }}>
            {profile?.full_name || 'Admin'}
          </span>
          <span className="block text-[11px] adm-truncate" style={{ color: 'var(--adm-silk-faint)' }}>
            {profile?.role?.label || 'Admin'}
          </span>
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -5, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.98 }}
            transition={{ duration: 0.13 }}
            className="absolute right-0 mt-2 w-60 p-1.5 rounded-xl z-50"
            style={{
              background: 'var(--adm-panel)',
              border: '1px solid var(--adm-trace)',
              boxShadow: 'var(--adm-shadow-lift)',
            }}
          >
            <div className="px-2.5 py-2 mb-1" style={{ borderBottom: '1px solid var(--adm-trace)' }}>
              <p className="text-sm font-semibold adm-truncate">{profile?.full_name || 'Admin'}</p>
              <p className="adm-data text-[11px] adm-truncate" style={{ color: 'var(--adm-silk-faint)' }}>
                {profile?.email}
              </p>
            </div>

            {isSuperAdmin && (
              <Link
                to="/admin/settings"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="adm-nav-link"
                style={{ height: 36 }}
              >
                <SlidersHorizontal size={16} /> Settings
              </Link>
            )}
            <a href="/" role="menuitem" className="adm-nav-link" style={{ height: 36 }}>
              <ExternalLink size={16} /> Open the website
            </a>
            <button
              type="button"
              role="menuitem"
              onClick={signOut}
              className="adm-nav-link w-full"
              style={{ height: 36, color: 'var(--adm-fault)' }}
            >
              <LogOut size={16} /> Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function TopNav() {
  const setMobileNav = useAdminStore(s => s.setMobileNav)
  const setPalette = useAdminStore(s => s.setPalette)
  const { pathname } = useLocation()
  const current = navItemForPath(pathname)

  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '')

  return (
    <header
      className="sticky top-0 z-30 flex items-center gap-2 px-4 sm:px-6"
      style={{
        height: 'var(--adm-bar)',
        background: 'color-mix(in srgb, var(--adm-panel) 88%, transparent)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid var(--adm-trace)',
      }}
    >
      <button
        type="button"
        onClick={() => setMobileNav(true)}
        className="adm-icon-btn adm-below-lg shrink-0"
        aria-label="Open navigation"
      >
        <Menu size={19} />
      </button>

      {/* Where you are, stated plainly. */}
      <p className="text-sm font-semibold adm-truncate" style={{ color: 'var(--adm-silk)' }}>
        {current?.label || 'Console'}
      </p>

      <div className="flex items-center gap-1.5 ml-auto shrink-0">
        <button
          type="button"
          onClick={() => setPalette(true)}
          className="adm-btn adm-btn-sm adm-from-sm"
          style={{ color: 'var(--adm-silk-faint)', fontWeight: 500 }}
        >
          <Search size={15} />
          Search
          <kbd
            className="adm-data ml-1 px-1.5 rounded text-[11px]"
            style={{ background: 'var(--adm-board-sunk)', color: 'var(--adm-silk-faint)' }}
          >
            {isMac ? '⌘K' : 'Ctrl K'}
          </kbd>
        </button>
        <button
          type="button"
          onClick={() => setPalette(true)}
          className="adm-icon-btn adm-below-sm"
          aria-label="Search the console"
        >
          <Search size={17} />
        </button>

        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  )
}
