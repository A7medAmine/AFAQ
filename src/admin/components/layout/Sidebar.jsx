import { NavLink, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeftRight, Boxes, ChevronDown, Crown, ListChecks, Brain, Calendar, CircuitBoard, ClipboardCheck, Gauge, IdCard, Images, Inbox, Mail, Megaphone, Network,
  PanelLeftClose, PanelLeftOpen, ScrollText, Send, Shield, SlidersHorizontal, UserCheck, Wallet, X,
} from 'lucide-react'
import useAdminStore from '../../store/adminStore'
import { NAV_GROUPS, navItemForPath, navItemsFor } from '../../lib/permissions'

const ICONS = {
  Gauge, Calendar, ClipboardCheck, UserCheck, IdCard, Mail,
  CircuitBoard, Images, Megaphone, Boxes, ArrowLeftRight, Crown, ListChecks,
  Shield, Brain, ScrollText, SlidersHorizontal, Wallet, Send, Inbox, Network,
}

/** Queues surface as a count on the nav item that clears them. */
const BADGE_KEY = {
  '/admin/registrations': 'pendingRegistrations',
  '/admin/applications': 'pendingMembership',
  '/admin/messages': 'unreadMessages',
  '/admin/borrowing': 'overdueBorrows',
}

function NavItem({ item, expanded, badge, onNavigate }) {
  const Icon = ICONS[item.icon] || Gauge
  return (
    <li>
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
            {badge > 0 && <Badge count={badge} />}
          </>
        )}
        {!expanded && <span className="sr-only">{item.label}</span>}
      </NavLink>
    </li>
  )
}

function Badge({ count }) {
  return (
    <span
      className="adm-data text-[11px] px-1.5 rounded-md shrink-0"
      style={{ background: 'var(--adm-wait-wash)', color: 'var(--adm-wait)' }}
    >
      {count}
    </span>
  )
}

function NavList({ expanded, onNavigate }) {
  const role = useAdminStore(s => s.role())
  const counts = useAdminStore(s => s.counts)
  const closedGroups = useAdminStore(s => s.closedNavGroups)
  const toggleGroup = useAdminStore(s => s.toggleNavGroup)
  const { pathname } = useLocation()
  const items = navItemsFor(role)
  // The band holding the current screen never folds away under you.
  const activeGroup = navItemForPath(pathname)?.group
  const badgeFor = item => counts[BADGE_KEY[item.path]] || 0

  const bands = NAV_GROUPS
    .map(group => ({ ...group, items: items.filter(item => item.group === group.id) }))
    .filter(group => group.items.length)

  return (
    <nav className="flex-1 adm-scroll overflow-y-auto px-3 py-3">
      {bands.map((group, index) => {
        const foldable = expanded && group.label
        const open = !foldable || group.id === activeGroup || !closedGroups.includes(group.id)
        const pending = group.items.reduce((sum, item) => sum + badgeFor(item), 0)
        const listId = `adm-nav-${group.id}`

        return (
          <div key={group.id} className="mb-3 last:mb-0">
            {foldable ? (
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                disabled={group.id === activeGroup}
                aria-expanded={open}
                aria-controls={listId}
                className="adm-nav-group w-full flex items-center gap-2 px-3 mb-1"
              >
                <span className="adm-eyebrow flex-1 text-left">{group.label}</span>
                {!open && pending > 0 && <Badge count={pending} />}
                {group.id !== activeGroup && (
                  <ChevronDown
                    size={14}
                    className="shrink-0"
                    style={{ transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform 0.16s ease' }}
                    aria-hidden="true"
                  />
                )}
              </button>
            ) : (
              !expanded && index > 0 && (
                <div className="mx-3 mb-2" style={{ height: 1, background: 'var(--adm-trace)' }} aria-hidden="true" />
              )
            )}
            <AnimatePresence initial={false}>
              {open && (
                <motion.ul
                  id={listId}
                  key="items"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.16, ease: 'easeOut' }}
                  className="space-y-0.5 overflow-hidden"
                  // The active trace pokes left past the list edge; keep it visible.
                  style={{ marginLeft: -13, paddingLeft: 13 }}
                >
                  {group.items.map(item => (
                    <NavItem key={item.path} item={item} expanded={expanded} badge={badgeFor(item)} onNavigate={onNavigate} />
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
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
