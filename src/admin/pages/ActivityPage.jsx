import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Calendar, CircuitBoard, Crown, IdCard, Images, ListChecks, Mail, Megaphone, ScrollText, Shield, UserCheck,
} from 'lucide-react'
import { read, supabase } from '../lib/db'
import { formatDateTime, relativeTime } from '../lib/format'
import PageHeader, { FilterTabs } from '../components/ui/PageHeader'
import Panel from '../components/ui/Panel'
import EmptyState, { ErrorState } from '../components/ui/EmptyState'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import { SkeletonPanel } from '../components/ui/Skeleton'

const ENTITY = {
  events: { icon: Calendar, label: 'Event' },
  projects: { icon: CircuitBoard, label: 'Project' },
  announcements: { icon: Megaphone, label: 'Announcement' },
  gallery_albums: { icon: Images, label: 'Album' },
  gallery_images: { icon: Images, label: 'Photo' },
  event_registrations: { icon: UserCheck, label: 'Registration' },
  membership_applications: { icon: UserCheck, label: 'Application' },
  contact_messages: { icon: Mail, label: 'Message' },
  admin_users: { icon: Shield, label: 'Admin' },
  members: { icon: IdCard, label: 'Member' },
  member_positions: { icon: Crown, label: 'Role assignment' },
  member_roles: { icon: Crown, label: 'Role' },
  member_tasks: { icon: ListChecks, label: 'Task' },
  ai_knowledge: { icon: ScrollText, label: 'AI article' },
}

const TONE = {
  created: 'ok',
  updated: 'signal',
  deleted: 'fault',
  published: 'ok',
  unpublished: 'neutral',
  approved: 'ok',
  rejected: 'fault',
}

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'created', label: 'Created' },
  { value: 'updated', label: 'Changed' },
  { value: 'deleted', label: 'Deleted' },
]

/** "created" + "events" reads as "Created an event". */
function describe(entry) {
  const entity = ENTITY[entry.entity_type]
  const noun = entity?.label.toLowerCase() || entry.entity_type || 'record'
  const name = entry.metadata?.name
  const article = /^[aeiou]/.test(noun) ? 'an' : 'a'
  const verb = {
    created: `Created ${article} ${noun}`,
    updated: `Changed ${article} ${noun}`,
    deleted: `Deleted ${article} ${noun}`,
    published: `Published ${article} ${noun}`,
    unpublished: `Hid ${article} ${noun}`,
    approved: `Approved ${article} ${noun}`,
    rejected: `Rejected ${article} ${noun}`,
  }[entry.action] || `${entry.action} · ${noun}`

  return name ? `${verb} — ${name}` : verb
}

export default function ActivityPage() {
  const [entries, setEntries] = useState([])
  const [people, setPeople] = useState({})
  const [state, setState] = useState({ loading: true, error: null })
  const [action, setAction] = useState('all')

  const load = useCallback(async () => {
    setState(s => ({ ...s, error: null }))
    const [log, admins] = await Promise.all([
      read(supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(200)),
      read(supabase.from('admin_users').select('user_id, full_name, email, avatar_url')),
    ])

    if (!log.ok) { setState({ loading: false, error: log.message }); return }

    const byId = {}
    for (const admin of admins.data || []) byId[admin.user_id] = admin

    setEntries(log.data || [])
    setPeople(byId)
    setState({ loading: false, error: null })
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(
    () => (action === 'all' ? entries : entries.filter(e => e.action === action)),
    [entries, action]
  )

  const filterOptions = FILTERS.map(f => ({
    ...f,
    count: f.value === 'all' ? entries.length : entries.filter(e => e.action === f.value).length,
  }))

  /** Group by calendar day — "what happened Tuesday" is how people ask. */
  const days = useMemo(() => {
    const groups = new Map()
    for (const entry of filtered) {
      const key = new Date(entry.created_at).toDateString()
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(entry)
    }
    return [...groups.entries()]
  }, [filtered])

  return (
    <div>
      <PageHeader
        eyebrow="Console"
        title="Activity"
        description="Who changed what, most recent first. The last 200 actions are kept in view."
        actions={<Button onClick={load} busy={state.loading}>Refresh</Button>}
      />

      <div className="mb-4">
        <FilterTabs options={filterOptions} value={action} onChange={setAction} label="Action filter" />
      </div>

      {state.error ? (
        <Panel><ErrorState message={state.error} onRetry={load} /></Panel>
      ) : state.loading ? (
        <SkeletonPanel rows={6} />
      ) : entries.length === 0 ? (
        <Panel>
          <EmptyState
            icon={ScrollText}
            title="Nothing recorded yet"
            description="Actions taken in this console appear here. If it stays empty after you make a change, apply supabase/activity_logs_rls.sql to your database — it grants the console permission to write the log."
          />
        </Panel>
      ) : filtered.length === 0 ? (
        <Panel><EmptyState compact icon={ScrollText} title={`No ${action} actions`} description="Try another filter." /></Panel>
      ) : (
        <div className="space-y-6">
          {days.map(([day, dayEntries]) => (
            <section key={day}>
              <p className="adm-eyebrow mb-2.5">
                {new Date(day).toDateString() === new Date().toDateString() ? 'Today' : day}
              </p>
              <Panel>
                <ul>
                  {dayEntries.map((entry, index) => {
                    const person = people[entry.user_id]
                    const Icon = ENTITY[entry.entity_type]?.icon || ScrollText
                    return (
                      <li
                        key={entry.id}
                        className="flex items-center gap-3 px-4 py-3"
                        style={index ? { borderTop: '1px solid var(--adm-trace)' } : undefined}
                      >
                        <span
                          className="flex items-center justify-center rounded-lg shrink-0"
                          style={{ width: 32, height: 32, background: 'var(--adm-board-sunk)', color: 'var(--adm-silk-dim)' }}
                          aria-hidden="true"
                        >
                          <Icon size={15} />
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="block text-sm adm-truncate">{describe(entry)}</span>
                          <span className="block text-xs adm-truncate" style={{ color: 'var(--adm-silk-faint)' }}>
                            {person?.full_name || person?.email || 'Unknown admin'}
                          </span>
                        </span>

                        <Badge tone={TONE[entry.action] || 'neutral'}>{entry.action}</Badge>

                        <span
                          className="adm-data text-[11px] shrink-0 hidden sm:block"
                          style={{ color: 'var(--adm-silk-faint)' }}
                          title={formatDateTime(entry.created_at)}
                        >
                          {relativeTime(entry.created_at)}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </Panel>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
