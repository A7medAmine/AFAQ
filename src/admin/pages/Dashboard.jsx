import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight, CalendarPlus, CircuitBoard, ImagePlus, Megaphone, PackagePlus, RefreshCw, UserRoundPlus,
} from 'lucide-react'
import { read, run, supabase } from '../lib/db'
import useAdminStore from '../store/adminStore'
import useCounts from '../hooks/useCounts'
import { hasPermission } from '../lib/permissions'
import { formatDate, relativeTime } from '../lib/format'
import PageHeader from '../components/ui/PageHeader'
import Panel, { PanelHead } from '../components/ui/Panel'
import StatusRail from '../components/ui/StatusRail'
import IntakeChart, { buildIntakeSeries } from '../components/ui/IntakeChart'
import { StatusBadge } from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import { TextField } from '../components/ui/Field'
import { SkeletonPanel } from '../components/ui/Skeleton'
import { ErrorState } from '../components/ui/EmptyState'

const since = days => {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

export default function Dashboard() {
  const role = useAdminStore(s => s.role())
  const profile = useAdminStore(s => s.adminProfile)
  const navigate = useNavigate()
  const { counts, loading: countsLoading, refresh: refreshCounts } = useCounts()

  const [state, setState] = useState({ loading: true, error: null })
  const [intake, setIntake] = useState([])
  const [events, setEvents] = useState([])
  const [messages, setMessages] = useState([])
  const [seatsByEvent, setSeatsByEvent] = useState({})
  const [memberModal, setMemberModal] = useState(false)

  const load = useCallback(async () => {
    setState({ loading: true, error: null })

    const [regs, apps, upcoming, msgs] = await Promise.all([
      read(supabase.from('event_registrations').select('created_at').gte('created_at', since(30))),
      read(supabase.from('membership_applications').select('created_at').gte('created_at', since(30))),
      read(
        supabase
          .from('events')
          .select('id, title_en, date, time, max_participants, registration_open, is_published')
          .gte('date', new Date().toISOString().split('T')[0])
          .order('date', { ascending: true })
          .limit(5)
      ),
      read(
        supabase
          .from('contact_messages')
          .select('id, name, subject, created_at, is_read')
          .order('created_at', { ascending: false })
          .limit(5)
      ),
    ])

    const failure = [regs, apps, upcoming, msgs].find(r => !r.ok)
    if (failure) {
      setState({ loading: false, error: failure.message })
      return
    }

    setIntake(buildIntakeSeries(regs.data, apps.data))
    setEvents(upcoming.data || [])
    setMessages(msgs.data || [])

    // Seats sold per upcoming event, so "40 seats" stops being a number with
    // no context and becomes "31 of 40 taken".
    const eventIds = (upcoming.data || []).map(e => e.id)
    if (eventIds.length) {
      const { data: approved } = await read(
        supabase
          .from('event_registrations')
          .select('event_id')
          .in('event_id', eventIds)
          .eq('status', 'approved')
      )
      const tally = {}
      for (const row of approved || []) tally[row.event_id] = (tally[row.event_id] || 0) + 1
      setSeatsByEvent(tally)
    }

    setState({ loading: false, error: null })
  }, [])

  useEffect(() => { load() }, [load])

  const refreshAll = () => { load(); refreshCounts() }

  /** Only surface a queue this admin is allowed to clear. */
  const channels = [
    {
      id: 'registrations', label: 'Registrations pending', count: counts.pendingRegistrations,
      to: '/admin/registrations?status=pending', permission: 'events.registrations.manage',
    },
    {
      id: 'membership', label: 'Applications pending', count: counts.pendingMembership,
      to: '/admin/applications?status=pending', permission: 'membership.manage',
    },
    {
      id: 'messages', label: 'Messages unread', count: counts.unreadMessages,
      to: '/admin/messages?status=unread', permission: 'messages.view',
    },
    {
      id: 'drafts', label: 'Unpublished drafts', count: counts.drafts,
      to: '/admin/events?status=draft', permission: 'events.manage', tone: 'wait',
    },
    {
      id: 'overdue-borrows', label: 'Items overdue', count: counts.overdueBorrows,
      to: '/admin/borrowing', permission: 'inventory.manage', tone: 'fault',
    },
  ].filter(c => hasPermission(role, c.permission))

  const quickActions = [
    { label: 'Add a member', icon: UserRoundPlus, permission: 'membership.manage', onClick: () => setMemberModal(true) },
    { label: 'New event', icon: CalendarPlus, permission: 'events.manage', onClick: () => navigate('/admin/events?new=1') },
    { label: 'New project', icon: CircuitBoard, permission: 'projects.manage', onClick: () => navigate('/admin/projects?new=1') },
    { label: 'New album', icon: ImagePlus, permission: 'gallery.manage', onClick: () => navigate('/admin/gallery?new=1') },
    { label: 'Post an announcement', icon: Megaphone, permission: 'announcements.manage', onClick: () => navigate('/admin/announcements?new=1') },
    { label: 'Add inventory item', icon: PackagePlus, permission: 'inventory.manage', onClick: () => navigate('/admin/inventory?new=1') },
  ].filter(a => hasPermission(role, a.permission))

  const firstName = (profile?.full_name || '').split(' ')[0]

  return (
    <div>
      <PageHeader
        eyebrow="AFAQ Scientific Club"
        title={firstName ? `Welcome back, ${firstName}` : 'Console overview'}
        description={`Everything waiting on you, as of ${formatDate(new Date())}.`}
        actions={
          <Button icon={RefreshCw} onClick={refreshAll} busy={state.loading && !!intake.length}>
            Refresh
          </Button>
        }
      />

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
        <StatusRail channels={channels} loading={countsLoading} />
      </motion.div>

      {state.error ? (
        <Panel className="mt-6">
          <ErrorState message={state.error} onRetry={load} />
        </Panel>
      ) : state.loading ? (
        <div className="grid gap-5 mt-6 lg:grid-cols-3">
          <SkeletonPanel rows={5} className="lg:col-span-2" />
          <SkeletonPanel rows={4} />
        </div>
      ) : (
        <>
          <div className="grid gap-5 mt-6 lg:grid-cols-3">
            <Panel className="lg:col-span-2">
              <PanelHead
                eyebrow="Last 30 days"
                title="Who signed up"
                description="Event registrations and membership applications, by day."
              />
              <div className="p-5">
                <IntakeChart data={intake} />
              </div>
            </Panel>

            <Panel>
              <PanelHead
                eyebrow="Schedule"
                title="Next events"
                action={
                  hasPermission(role, 'events.manage') && (
                    <Link
                      to="/admin/events"
                      className="text-[13px] font-semibold inline-flex items-center gap-1"
                      style={{ color: 'var(--adm-signal)' }}
                    >
                      All events <ArrowRight size={13} />
                    </Link>
                  )
                }
              />
              <div className="p-2">
                {events.length === 0 ? (
                  <p className="text-sm text-center py-10 px-4" style={{ color: 'var(--adm-silk-faint)' }}>
                    Nothing scheduled. Create an event to open registration.
                  </p>
                ) : (
                  <ul>
                    {events.map(event => {
                      const taken = seatsByEvent[event.id] || 0
                      const capacity = event.max_participants || 0
                      const ratio = capacity ? Math.min(1, taken / capacity) : 0
                      return (
                        <li key={event.id} className="px-3 py-3 rounded-lg" style={{ transition: 'background .12s' }}>
                          <div className="flex items-start justify-between gap-3 mb-1.5">
                            <p className="text-sm font-semibold adm-truncate">{event.title_en}</p>
                            {!event.is_published
                              ? <StatusBadge status="draft" />
                              : event.registration_open
                                ? <StatusBadge status="open" />
                                : <StatusBadge status="closed" />}
                          </div>
                          <p className="adm-data text-xs mb-2" style={{ color: 'var(--adm-silk-faint)' }}>
                            {formatDate(event.date)}{event.time ? ` · ${event.time.slice(0, 5)}` : ''}
                          </p>
                          {capacity > 0 && (
                            <>
                              <div
                                className="h-1 rounded-full overflow-hidden"
                                style={{ background: 'var(--adm-board-sunk)' }}
                                role="img"
                                aria-label={`${taken} of ${capacity} seats taken`}
                              >
                                <div
                                  style={{
                                    width: `${ratio * 100}%`,
                                    height: '100%',
                                    background: ratio >= 1 ? 'var(--adm-wait)' : 'var(--adm-signal)',
                                  }}
                                />
                              </div>
                              <p className="adm-data text-[11px] mt-1.5" style={{ color: 'var(--adm-silk-faint)' }}>
                                {taken} / {capacity} seats
                              </p>
                            </>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </Panel>
          </div>

          <div className="grid gap-5 mt-5 lg:grid-cols-3">
            <Panel className="lg:col-span-2">
              <PanelHead
                eyebrow="Inbox"
                title="Latest messages"
                action={
                  <Link
                    to="/admin/messages"
                    className="text-[13px] font-semibold inline-flex items-center gap-1"
                    style={{ color: 'var(--adm-signal)' }}
                  >
                    All messages <ArrowRight size={13} />
                  </Link>
                }
              />
              {messages.length === 0 ? (
                <p className="text-sm text-center py-10 px-4" style={{ color: 'var(--adm-silk-faint)' }}>
                  No one has used the contact form yet.
                </p>
              ) : (
                <ul className="p-2">
                  {messages.map(message => (
                    <li key={message.id}>
                      <Link
                        to={`/admin/messages?q=${encodeURIComponent(message.subject || message.name)}`}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg adm-nav-link"
                        style={{ height: 'auto' }}
                      >
                        <span
                          className="rounded-full shrink-0"
                          style={{
                            width: 7, height: 7,
                            background: message.is_read ? 'var(--adm-trace-strong)' : 'var(--adm-signal)',
                          }}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium adm-truncate" style={{ color: 'var(--adm-silk)' }}>
                            {message.subject}
                          </span>
                          <span className="block text-xs adm-truncate" style={{ color: 'var(--adm-silk-faint)' }}>
                            {message.name}
                          </span>
                        </span>
                        <span className="adm-data text-[11px] shrink-0" style={{ color: 'var(--adm-silk-faint)' }}>
                          {relativeTime(message.created_at)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel>
              <PanelHead eyebrow="Shortcuts" title="Start something" />
              <div className="p-4 flex flex-col gap-2">
                {quickActions.map(action => (
                  <button
                    key={action.label}
                    type="button"
                    onClick={action.onClick}
                    className="adm-btn justify-start"
                    style={{ height: 40 }}
                  >
                    <action.icon size={16} style={{ color: 'var(--adm-signal)' }} />
                    {action.label}
                  </button>
                ))}
              </div>
            </Panel>
          </div>
        </>
      )}

      <AddMemberModal
        open={memberModal}
        onClose={() => setMemberModal(false)}
        onAdded={refreshAll}
      />
    </div>
  )
}

/** Walk-in members joined at a stand get added by hand, already approved. */
function AddMemberModal({ open, onClose, onAdded }) {
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', department: '', student_id: '' })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setForm({ full_name: '', email: '', phone: '', department: '', student_id: '' })
      setErrors({})
    }
  }, [open])

  const set = (key, value) => {
    setForm(f => ({ ...f, [key]: value }))
    setErrors(e => ({ ...e, [key]: undefined }))
  }

  const submit = async () => {
    const next = {}
    if (!form.full_name.trim()) next.full_name = 'Enter the member’s name.'
    if (!form.email.trim()) next.email = 'Enter an email address.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'That is not a valid email address.'
    if (Object.keys(next).length) { setErrors(next); return }

    setSaving(true)
    const { ok } = await run(
      supabase.from('members').insert({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        department: form.department.trim() || null,
        student_id: form.student_id.trim() || null,
      }),
      { success: `${form.full_name.trim()} added to the club.`, failure: 'The member was not added.' }
    )
    setSaving(false)
    if (ok) { onClose(); onAdded() }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a member"
      description="For people who joined in person. No email is sent; issue a card from the Members page."
      footer={
        <>
          <Button onClick={onClose} data-dialog-dismiss="true">Cancel</Button>
          <Button variant="primary" onClick={submit} busy={saving} busyLabel="Adding…">Add member</Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextField
          label="Full name" required
          value={form.full_name} error={errors.full_name}
          onChange={e => set('full_name', e.target.value)}
          placeholder="Ahmed Mansouri"
        />
        <TextField
          label="Email" type="email" required
          value={form.email} error={errors.email}
          onChange={e => set('email', e.target.value)}
          placeholder="ahmed@univ-bouira.dz"
        />
        <div className="grid sm:grid-cols-2 gap-4">
          <TextField
            label="Phone" value={form.phone}
            onChange={e => set('phone', e.target.value)}
            placeholder="+213 6XX XXX XXX"
          />
          <TextField
            label="Student ID" value={form.student_id}
            onChange={e => set('student_id', e.target.value)}
          />
        </div>
        <TextField
          label="Department" value={form.department}
          onChange={e => set('department', e.target.value)}
          placeholder="Computer Science"
        />
      </div>
    </Modal>
  )
}
