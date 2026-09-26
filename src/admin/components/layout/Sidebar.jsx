import { NavLink } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeftRight, Boxes, Crown, ListChecks, Brain, Calendar, CircuitBoard, ClipboardCheck, Gauge, IdCard, Images, Mail, Megaphone,
  PanelLeftClose, PanelLeftOpen, ScrollText, Send, Shield, SlidersHorizontal, UserCheck, Wallet, X,
} from 'lucide-react'
import useAdminStore from '../../store/adminStore'
import { NAV_GROUPS, navItemsFor } from '../../lib/permissions'

const ICONS = {
  Gauge, Calendar, ClipboardCheck, UserCheck, IdCard, Mail,
  CircuitBoard, Images, Megaphone, Boxes, ArrowLeftRight, Crown, ListChecks,
  Shield, Brain, ScrollText, SlidersHorizontal, Wallet, Send,
}

/** Queues surface as a count on the nav item that clears them. */
const BADGE_KEY = {
  '/admin/registrations': 'pendingRegistrations',
  '/admin/applications': 'pendingMembership',
  '/admin/messages': 'unreadMessages',
  '/admin/borrowing': 'overdueBorrows',
}

function NavList({ expanded, onNavigate }) {
  const role = useAdminStore(s => s.role())
  const counts = useAdminStore(s => s.counts)
  const items = navItemsFor(role)

  return (
    <nav className="flex-1 adm-scroll overflow-y-auto px-3 py-3">
      {NAV_GROUPS.map(group => {
        const groupItems = items.filter(item => item.group === group.id)
        if (!groupItems.length) return null

        return (
          <div key={group.id} className="mb-4 last:mb-0">
            {expanded ? (
              <p className="adm-eyebrow px-3 mb-2">{group.label}</p>
            ) : (
              <div
                className="mx-3 mb-2"
                style={{ height: 1, background: 'var(--adm-trace)' }}
                aria-hidden="true"
              />
            )}
            <ul className="space-y-0.5">
              {groupItems.map(item => {
                const Icon = ICONS[item.icon] || Gauge
                const badge = counts[BADGE_KEY[item.path]] || 0
                return (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      end={item.end}
                      onClick={onNavigate}
                      className="adm-nav-link"
                      style={{ justifyContent: expanded ? 'flex-start' : 'center', paddingInline: expanded ? 12 : 0 }}
                      title={expanded ? undefined : item.label}
                    >
                      <span className="relative shrink-0 flex">
                        <Icon size={18} />
                        {/* Collapsed rail keeps the signal without the number. */}
                        {!expanded && badge > 0 && (
                          <span
                            className="absolute -top-1 -right-1.5 rounded-full"
                            style={{ width: 6, height: 6, background: 'var(--adm-wait)' }}
                            aria-hidden="true"
                          />
                        )}
                      </span>
                      {expanded && (
                        <>
                          <span className="flex-1 adm-truncate">{item.label}</span>
                          {badge > 0 && (
                            <span
                              className="adm-data text-[11px] px-1.5 rounded-md shrink-0"
                              style={{ background: 'var(--adm-wait-wash)', color: 'var(--adm-wait)' }}
                            >
                              {badge}
                            </span>
                          )}
                        </>
                      )}
                      {!expanded && <span className="sr-only">{item.label}</span>}
                    </NavLink>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </nav>
  )
}

function Wordmark({ expanded }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <span
        className="adm-pixel flex items-center justify-center shrink-0"
        style={{
          width: 30, height: 30, borderRadius: 8, fontSize: 13,
          background: 'var(--adm-signal)', color: 'var(--adm-signal-ink)',
        }}
        aria-hidden="true"
      >
        A
      </span>
      {expanded && (
        <span className="min-w-0">
          <span className="adm-pixel block text-[13px] leading-none tracking-wider" style={{ color: 'var(--adm-silk)' }}>
            AFAQ
          </span>
          <span className="adm-eyebrow block mt-1">Console</span>
        </span>
      )}
    </div>
  )
}

export default function Sidebar() {
  const expanded = useAdminStore(s => s.navExpanded)
  const toggleNav = useAdminStore(s => s.toggleNav)
  const mobileOpen = useAdminStore(s => s.mobileNavOpen)
  const setMobileNav = useAdminStore(s => s.setMobileNav)

  return (
    <>
      {/* Desktop rail. Collapsing is a deliberate click that sticks, not a
          panel that flies out whenever the pointer crosses the left edge. */}
      <aside
        className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 z-40"
        style={{
          width: expanded ? 'var(--adm-rail-open)' : 'var(--adm-rail)',
          background: 'var(--adm-panel)',
          borderRight: '1px solid var(--adm-trace)',
          transition: 'width 0.18s ease',
        }}
      >
        <div
          className="flex items-center shrink-0 px-4"
          style={{ height: 'var(--adm-bar)', justifyContent: expanded ? 'space-between' : 'center', gap: 8 }}
        >
          <Wordmark expanded={expanded} />
          {expanded && (
            <button type="button" onClick={toggleNav} className="adm-icon-btn shrink-0" aria-label="Collapse navigation">
              <PanelLeftClose size={17} />
            </button>
          )}
        </div>

        <NavList expanded={expanded} />

        {!expanded && (
          <div className="p-3 shrink-0 flex justify-center">
            <button type="button" onClick={toggleNav} className="adm-icon-btn" aria-label="Expand navigation">
              <PanelLeftOpen size={17} />
            </button>
          </div>
        )}
      </aside>

      {/* Mobile drawer. The old console had none — below the desktop breakpoint
          the rail was hidden and its toggle went with it, leaving no way to
          reach any screen but the one you landed on. */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="lg:hidden fixed inset-0 z-[70]">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0"
              style={{ background: 'rgba(6, 10, 16, 0.5)' }}
              onClick={() => setMobileNav(false)}
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 320 }}
              className="absolute left-0 top-0 bottom-0 w-[262px] flex flex-col"
              style={{ background: 'var(--adm-panel)', borderRight: '1px solid var(--adm-trace)' }}
              aria-label="Console navigation"
            >
              <div
                className="flex items-center justify-between px-4 shrink-0"
                style={{ height: 'var(--adm-bar)', borderBottom: '1px solid var(--adm-trace)' }}
              >
                <Wordmark expanded />
                <button
                  type="button"
                  onClick={() => setMobileNav(false)}
                  className="adm-icon-btn"
                  aria-label="Close navigation"
                >
                  <X size={18} />
                </button>
              </div>
              <NavList expanded onNavigate={() => setMobileNav(false)} />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
