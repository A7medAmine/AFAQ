import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Brain, Calendar, CircuitBoard, ClipboardCheck, CornerDownLeft, Gauge, Images,
  Loader2, Mail, Megaphone, ScrollText, Search, Shield, SlidersHorizontal, UserCheck,
} from 'lucide-react'
import useAdminStore from '../../store/adminStore'
import { hasPermission, navItemsFor } from '../../lib/permissions'
import { supabase } from '../../lib/db'

const ICONS = {
  Gauge, Calendar, ClipboardCheck, UserCheck, Mail,
  CircuitBoard, Images, Megaphone, Shield, Brain, ScrollText, SlidersHorizontal,
}

/**
 * Records searchable from the palette. Each one names the column people
 * actually remember — a person's name, an event's title — not an id.
 */
const SOURCES = [
  {
    table: 'events', permission: 'events.manage', path: '/admin/events',
    icon: Calendar, group: 'Events',
    columns: 'id, title_en, date', match: 'title_en',
    title: r => r.title_en, subtitle: r => r.date,
  },
  {
    table: 'event_registrations', permission: 'events.registrations.manage', path: '/admin/registrations',
    icon: ClipboardCheck, group: 'Registrations',
    columns: 'id, full_name, email, status', match: 'full_name,email',
    title: r => r.full_name, subtitle: r => `${r.email} · ${r.status}`,
  },
  {
    table: 'membership_applications', permission: 'membership.manage', path: '/admin/membership',
    icon: UserCheck, group: 'Membership',
    columns: 'id, full_name, email, status', match: 'full_name,email',
    title: r => r.full_name, subtitle: r => `${r.email} · ${r.status}`,
  },
  {
    table: 'projects', permission: 'projects.manage', path: '/admin/projects',
    icon: CircuitBoard, group: 'Projects',
    columns: 'id, title_en, category', match: 'title_en',
    title: r => r.title_en, subtitle: r => r.category || 'Uncategorised',
  },
  {
    table: 'contact_messages', permission: 'messages.view', path: '/admin/messages',
    icon: Mail, group: 'Messages',
    columns: 'id, name, subject', match: 'name,subject,email',
    title: r => r.subject, subtitle: r => r.name,
  },
  {
    table: 'announcements', permission: 'announcements.manage', path: '/admin/announcements',
    icon: Megaphone, group: 'Announcements',
    columns: 'id, title_en', match: 'title_en',
    title: r => r.title_en, subtitle: () => null,
  },
]

/**
 * ⌘K / Ctrl-K. Jump to any screen, or find a person, event or message by name
 * without knowing which list holds it. The console had no search of any kind
 * before this — finding one applicant meant opening a page and scrolling.
 */
export default function CommandPalette() {
  const open = useAdminStore(s => s.paletteOpen)
  const setOpen = useAdminStore(s => s.setPalette)
  const role = useAdminStore(s => s.role())
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [records, setRecords] = useState([])
  const [searching, setSearching] = useState(false)
  const [active, setActive] = useState(0)
  const listRef = useRef(null)

  const destinations = useMemo(() => {
    const term = query.trim().toLowerCase()
    return navItemsFor(role)
      .filter(item => !term || item.label.toLowerCase().includes(term))
      .map(item => ({
        key: `nav:${item.path}`,
        kind: 'destination',
        group: 'Go to',
        icon: ICONS[item.icon] || Gauge,
        title: item.label,
        subtitle: null,
        to: item.path,
      }))
  }, [query, role])

  // Global shortcut. Registered once, works from anywhere in the console.
  useEffect(() => {
    const onKey = event => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen(!open)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setRecords([])
      setActive(0)
    }
  }, [open])

  useEffect(() => { setActive(0) }, [query])

  // Debounced record lookup across every list this role may open.
  useEffect(() => {
    const term = query.trim()
    if (term.length < 2) {
      setRecords([])
      setSearching(false)
      return
    }

    let cancelled = false
    setSearching(true)
    const timer = setTimeout(async () => {
      const allowed = SOURCES.filter(s => hasPermission(role, s.permission))
      const escaped = term.replace(/[,().%*:\\]/g, ' ').trim()
      if (!escaped) {
        setRecords([])
        setSearching(false)
        return
      }
      const results = await Promise.all(
        allowed.map(async source => {
          const filter = source.match.split(',').map(col => `${col}.ilike.%${escaped}%`).join(',')
          const { data } = await supabase
            .from(source.table)
            .select(source.columns)
            .or(filter)
            .limit(4)
          return (data || []).map(row => ({
            key: `${source.table}:${row.id}`,
            kind: 'record',
            group: source.group,
            icon: source.icon,
            title: source.title(row) || '(untitled)',
            subtitle: source.subtitle(row),
            to: `${source.path}?q=${encodeURIComponent(source.title(row) || term)}`,
          }))
        })
      )
      if (!cancelled) {
        setRecords(results.flat())
        setSearching(false)
      }
    }, 220)

    return () => { cancelled = true; clearTimeout(timer) }
  }, [query, role])

  const results = useMemo(() => [...destinations, ...records], [destinations, records])

  const choose = useCallback(item => {
    if (!item) return
    setOpen(false)
    navigate(item.to)
  }, [navigate, setOpen])

  const onKeyDown = event => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive(i => Math.min(i + 1, results.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive(i => Math.max(i - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      choose(results[active])
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active, results.length])

  let lastGroup = null

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[90] flex items-start justify-center px-4 pt-[12vh]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="absolute inset-0"
            style={{ background: 'rgba(6, 10, 16, 0.55)', backdropFilter: 'blur(3px)' }}
            onClick={() => setOpen(false)}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Search the console"
            initial={{ opacity: 0, y: -10, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.985 }}
            transition={{ type: 'spring', damping: 30, stiffness: 380 }}
            className="relative w-full max-w-[560px] flex flex-col overflow-hidden"
            style={{
              background: 'var(--adm-panel)',
              border: '1px solid var(--adm-trace)',
              borderRadius: 16,
              boxShadow: 'var(--adm-shadow-lift)',
              maxHeight: '62vh',
            }}
          >
            <div
              className="flex items-center gap-2.5 px-4 shrink-0"
              style={{ height: 52, borderBottom: '1px solid var(--adm-trace)' }}
            >
              {searching
                ? <Loader2 size={17} className="adm-spin" style={{ color: 'var(--adm-signal)' }} />
                : <Search size={17} style={{ color: 'var(--adm-silk-faint)' }} />}
              {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search screens, people, events…"
                aria-label="Search screens, people, events"
                className="flex-1 bg-transparent border-0 outline-none text-[15px]"
                style={{ color: 'var(--adm-silk)' }}
              />
              <kbd
                className="adm-data px-1.5 rounded text-[11px]"
                style={{ background: 'var(--adm-board-sunk)', color: 'var(--adm-silk-faint)' }}
              >
                esc
              </kbd>
            </div>

            <div ref={listRef} className="adm-scroll overflow-y-auto p-1.5 flex-1">
              {results.length === 0 ? (
                <p className="text-sm text-center py-10" style={{ color: 'var(--adm-silk-faint)' }}>
                  {query.trim().length < 2
                    ? 'Type to search across every list you can open.'
                    : searching ? 'Searching…' : `Nothing matches “${query.trim()}”.`}
                </p>
              ) : (
                results.map((item, index) => {
                  const Icon = item.icon
                  const showGroup = item.group !== lastGroup
                  lastGroup = item.group
                  return (
                    <div key={item.key}>
                      {showGroup && <p className="adm-eyebrow px-3 pt-3 pb-1.5">{item.group}</p>}
                      <button
                        type="button"
                        data-active={index === active}
                        onMouseMove={() => setActive(index)}
                        onClick={() => choose(item)}
                        className="w-full flex items-center gap-3 px-3 h-11 rounded-lg text-left"
                        style={{
                          background: index === active ? 'var(--adm-signal-wash)' : 'transparent',
                          color: index === active ? 'var(--adm-signal)' : 'var(--adm-silk)',
                        }}
                      >
                        <Icon size={16} className="shrink-0" style={{ opacity: 0.8 }} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium adm-truncate">{item.title}</span>
                          {item.subtitle && (
                            <span className="block text-xs adm-truncate" style={{ color: 'var(--adm-silk-faint)' }}>
                              {item.subtitle}
                            </span>
                          )}
                        </span>
                        {index === active && <CornerDownLeft size={13} className="shrink-0" />}
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
