import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CalendarPlus, Copy, Eye, EyeOff, ImageOff, Loader2, Pencil, ToggleLeft, ToggleRight, Trash2, Upload, Users,
} from 'lucide-react'
import { deleteUploadedFile, logActivity, read, run, supabase, uploadFile } from '../lib/db'
import useAdminStore from '../store/adminStore'
import useQueryParam from '../hooks/useQueryParam'
import { formatDate, formatDateTime, isPast, toDateInput, toForm } from '../lib/format'
import PageHeader, { FilterTabs } from '../components/ui/PageHeader'
import DataTable from '../components/ui/DataTable'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import EmptyState, { ErrorState } from '../components/ui/EmptyState'
import Button, { IconButton } from '../components/ui/Button'
import ExportMenu from '../components/ui/ExportMenu'
import Badge, { StatusBadge } from '../components/ui/Badge'
import Panel from '../components/ui/Panel'
import { CheckField, LocalizedField, TextField } from '../components/ui/Field'

const BLANK = {
  title_en: '', title_ar: '', title_fr: '',
  description_en: '', description_ar: '', description_fr: '',
  location_en: '', location_ar: '', location_fr: '',
  date: '', time: '', poster_url: '', max_participants: 0,
  registration_open: false, is_published: false,
}

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past' },
  { value: 'draft', label: 'Drafts' },
]

export default function EventsPage() {
  const addToast = useAdminStore(s => s.addToast)
  const adminProfile = useAdminStore(s => s.adminProfile)

  const [events, setEvents] = useState([])
  const [seats, setSeats] = useState({})
  const [state, setState] = useState({ loading: true, error: null })
  const [status, setStatus] = useQueryParam('status', 'all')
  const [search] = useQueryParam('q')
  const [newFlag, setNewFlag] = useQueryParam('new')

  const [editor, setEditor] = useState(null)   // { event | null }
  const [pendingDelete, setPendingDelete] = useState(null)
  const [working, setWorking] = useState({})

  const load = useCallback(async () => {
    setState(s => ({ ...s, error: null }))
    const [list, regs] = await Promise.all([
      read(supabase.from('events').select('*').order('date', { ascending: false })),
      read(supabase.from('event_registrations').select('event_id, status')),
    ])

    if (!list.ok) {
      setState({ loading: false, error: list.message })
      return
    }

    const tally = {}
    for (const row of regs.data || []) {
      const bucket = tally[row.event_id] || (tally[row.event_id] = { total: 0, approved: 0 })
      bucket.total += 1
      if (row.status === 'approved') bucket.approved += 1
    }

    setEvents(list.data || [])
    setSeats(tally)
    setState({ loading: false, error: null })
  }, [])

  useEffect(() => { load() }, [load])

  // Quick actions on the dashboard link straight into the create form.
  useEffect(() => {
    if (newFlag) { setEditor({ event: null }); setNewFlag('') }
  }, [newFlag, setNewFlag])

  const filtered = useMemo(() => {
    if (status === 'draft') return events.filter(e => !e.is_published)
    if (status === 'past') return events.filter(e => isPast(e.date))
    if (status === 'upcoming') return events.filter(e => !isPast(e.date))
    return events
  }, [events, status])

  const filterOptions = FILTERS.map(f => ({
    ...f,
    count: f.value === 'all' ? events.length
      : f.value === 'draft' ? events.filter(e => !e.is_published).length
        : f.value === 'past' ? events.filter(e => isPast(e.date)).length
          : events.filter(e => !isPast(e.date)).length,
  }))

  const mark = (id, busy) => setWorking(w => ({ ...w, [id]: busy }))

  const toggleField = async (event, field, labels) => {
    mark(event.id, true)
    const next = !event[field]
    const { ok } = await run(
      supabase.from('events').update({ [field]: next }).eq('id', event.id),
      { success: next ? labels.on : labels.off, failure: 'That switch did not change.' }
    )
    mark(event.id, false)
    if (ok) {
      setEvents(list => list.map(e => (e.id === event.id ? { ...e, [field]: next } : e)))
      if (field === 'is_published') {
        logActivity(next ? 'published' : 'unpublished', 'events', event.id, { name: event.title_en })
      }
    }
  }

  const duplicate = async event => {
    const { id, created_at, updated_at, ...rest } = event
    const { ok } = await run(
      supabase.from('events').insert({
        ...rest,
        title_en: `${event.title_en} (copy)`,
        is_published: false,
        registration_open: false,
        created_by: adminProfile?.user_id,
      }),
      { success: 'Copied as an unpublished draft.', failure: 'The copy was not created.' }
    )
    if (ok) load()
  }

  const remove = async () => {
    const event = pendingDelete
    const { ok } = await run(
      supabase.from('events').delete().eq('id', event.id),
      { success: `“${event.title_en}” deleted.`, failure: 'The event was not deleted.' }
    )
    if (ok) {
      logActivity('deleted', 'events', event.id, { name: event.title_en })
      if (event.poster_url) deleteUploadedFile(event.poster_url)
      setPendingDelete(null)
      load()
    }
  }

  const columns = useMemo(() => [
    {
      header: 'Event',
      accessorKey: 'title_en',
      cell: ({ row }) => (
        <div className="flex items-center gap-3 min-w-0">
          {row.original.poster_url ? (
            <img
              src={row.original.poster_url}
              alt=""
              className="rounded-md object-cover shrink-0"
              style={{ width: 34, height: 34, border: '1px solid var(--adm-trace)' }}
            />
          ) : (
            <span
              className="flex items-center justify-center rounded-md shrink-0"
              style={{ width: 34, height: 34, background: 'var(--adm-board-sunk)', color: 'var(--adm-silk-faint)' }}
              aria-hidden="true"
            >
              <ImageOff size={14} />
            </span>
          )}
          <span className="min-w-0">
            <span className="block text-sm font-semibold adm-truncate" style={{ maxWidth: 260 }}>
              {row.original.title_en}
            </span>
            <span className="adm-data block text-[11px]" style={{ color: 'var(--adm-silk-faint)' }}>
              {formatDate(row.original.date)}
              {row.original.time ? ` · ${row.original.time.slice(0, 5)}` : ''}
            </span>
          </span>
        </div>
      ),
    },
    {
      header: 'Seats',
      id: 'seats',
      accessorFn: row => seats[row.id]?.approved || 0,
      cell: ({ row }) => {
        const taken = seats[row.original.id]?.approved || 0
        const pending = (seats[row.original.id]?.total || 0) - taken
        const capacity = row.original.max_participants || 0
        return (
          <span className="adm-data text-[13px]">
            {capacity ? `${taken}/${capacity}` : taken || '—'}
            {pending > 0 && (
              <span className="ml-1.5" style={{ color: 'var(--adm-wait)' }}>+{pending} pending</span>
            )}
          </span>
        )
      },
    },
    {
      header: 'Registration',
      accessorKey: 'registration_open',
      cell: ({ row }) => <StatusBadge status={row.original.registration_open ? 'open' : 'closed'} />,
    },
    {
      header: 'Visibility',
      accessorKey: 'is_published',
      cell: ({ row }) => <StatusBadge status={row.original.is_published ? 'published' : 'draft'} />,
    },
    {
      header: '',
      id: 'actions',
      enableSorting: false,
      cell: ({ row }) => {
        const event = row.original
        const busy = working[event.id]
        return (
          <div className="flex items-center justify-end gap-0.5" onClick={e => e.stopPropagation()}>
            {busy && <Loader2 size={14} className="adm-spin mr-1" style={{ color: 'var(--adm-silk-faint)' }} />}
            <IconButton
              icon={event.is_published ? EyeOff : Eye}
              label={event.is_published ? 'Unpublish' : 'Publish'}
              disabled={busy}
              onClick={() => toggleField(event, 'is_published', {
                on: `“${event.title_en}” is live on the site.`,
                off: `“${event.title_en}” is hidden from the site.`,
              })}
            />
            <IconButton
              icon={event.registration_open ? ToggleRight : ToggleLeft}
              label={event.registration_open ? 'Close registration' : 'Open registration'}
              disabled={busy}
              onClick={() => toggleField(event, 'registration_open', {
                on: 'Registration is open.',
                off: 'Registration is closed.',
              })}
            />
            <IconButton icon={Copy} label="Duplicate" onClick={() => duplicate(event)} />
            <IconButton icon={Pencil} label="Edit" onClick={() => setEditor({ event })} />
            <IconButton icon={Trash2} label="Delete" danger onClick={() => setPendingDelete(event)} />
          </div>
        )
      },
    },
  ], [seats, working]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <PageHeader
        eyebrow="Operate"
        title="Events"
        description="Workshops, talks and competitions. Publishing puts an event on the public site; opening registration lets people sign up."
        actions={
          <>
            <ExportMenu
              filename={`events-${status}-${new Date().toISOString().slice(0, 10)}`}
              title="Events"
              subtitle={`${FILTERS.find(f => f.value === status)?.label || 'All'} · ${formatDateTime(new Date())}`}
              headers={['Title', 'Date', 'Time', 'Seats taken', 'Capacity', 'Registration', 'Visibility']}
              rows={filtered.map(e => [
                e.title_en, formatDate(e.date), e.time ? e.time.slice(0, 5) : '',
                seats[e.id]?.approved || 0, e.max_participants || '—',
                e.registration_open ? 'open' : 'closed', e.is_published ? 'published' : 'draft',
              ])}
              statusColumnIndex={6}
              disabled={!filtered.length}
            />
            <Button variant="primary" icon={CalendarPlus} onClick={() => setEditor({ event: null })}>New event</Button>
          </>
        }
      />

      {state.error ? (
        <Panel><ErrorState message={state.error} onRetry={load} /></Panel>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          loading={state.loading}
          initialSearch={search}
          getRowId={row => String(row.id)}
          onRowClick={event => setEditor({ event })}
          searchPlaceholder="Search events…"
          initialSort={[{ id: 'title_en', desc: false }]}
          toolbar={<FilterTabs options={filterOptions} value={status} onChange={setStatus} label="Event filter" />}
          emptyState={
            events.length === 0 ? (
              <EmptyState
                icon={CalendarPlus}
                title="No events yet"
                description="Create one to put it on the public calendar and start taking registrations."
                action={<Button variant="primary" icon={CalendarPlus} onClick={() => setEditor({ event: null })}>New event</Button>}
              />
            ) : (
              <EmptyState
                compact
                icon={Users}
                title={`No ${status} events`}
                description="Try another filter or clear the search."
              />
            )
          }
        />
      )}

      <EventEditor
        key={editor?.event?.id || 'new'}
        open={!!editor}
        event={editor?.event}
        onClose={() => setEditor(null)}
        onSaved={() => { setEditor(null); load() }}
        addToast={addToast}
        createdBy={adminProfile?.user_id}
      />

      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={remove}
        title="Delete this event?"
        message={
          pendingDelete
            ? `“${pendingDelete.title_en}” and all ${seats[pendingDelete.id]?.total || 0} of its registrations will be removed. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete event"
      />
    </div>
  )
}

function EventEditor({ open, event, onClose, onSaved, addToast, createdBy }) {
  const [form, setForm] = useState(BLANK)
  const [lang, setLang] = useState('en')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(0)

  useEffect(() => {
    if (!open) return
    setForm(event
      ? { ...toForm(BLANK, event), date: toDateInput(event.date), max_participants: event.max_participants || 0 }
      : BLANK)
    setErrors({})
    setLang('en')
  }, [open, event])

  const set = (key, value) => {
    setForm(f => ({ ...f, [key]: value }))
    setErrors(e => ({ ...e, [key]: undefined }))
  }

  const upload = async file => {
    if (!file) return
    setUploading(1)
    try {
      const url = await uploadFile(file, pct => setUploading(Math.max(1, pct)))
      set('poster_url', url)
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setUploading(0)
    }
  }

  const save = async () => {
    // The title and date are NOT NULL in the database. Saving without them used
    // to fail silently and still report success.
    const next = {}
    if (!form.title_en.trim()) next.title_en = 'An English title is required — it is what the site shows.'
    if (!form.date) next.date = 'Pick a date.'
    if (form.max_participants < 0) next.max_participants = 'Seats cannot be negative.'
    if (Object.keys(next).length) {
      setErrors(next)
      if (next.title_en) setLang('en')
      return
    }

    setSaving(true)
    const payload = {
      title_en: form.title_en.trim(), title_ar: form.title_ar.trim() || null, title_fr: form.title_fr.trim() || null,
      description_en: form.description_en || null, description_ar: form.description_ar || null, description_fr: form.description_fr || null,
      location_en: form.location_en || null, location_ar: form.location_ar || null, location_fr: form.location_fr || null,
      date: form.date,
      time: form.time || null,
      poster_url: form.poster_url || null,
      max_participants: Number(form.max_participants) || 0,
      registration_open: form.registration_open,
      is_published: form.is_published,
    }

    const { ok } = await run(
      event
        ? supabase.from('events').update(payload).eq('id', event.id)
        : supabase.from('events').insert({ ...payload, created_by: createdBy }),
      {
        success: event ? `“${payload.title_en}” updated.` : `“${payload.title_en}” created.`,
        failure: 'The event did not save.',
      }
    )
    setSaving(false)
    if (ok) onSaved()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={event ? 'Edit event' : 'New event'}
      description="Arabic and French are optional. The site falls back to English where a translation is missing."
      footer={
        <>
          <Button onClick={onClose} data-dialog-dismiss="true">Cancel</Button>
          <Button variant="primary" onClick={save} busy={saving} busyLabel="Saving…">
            {event ? 'Save changes' : 'Create event'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <LocalizedField
          label="Title" prefix="title" required
          values={form} onChange={set} lang={lang} onLangChange={setLang}
          error={errors.title_en}
        />
        <LocalizedField
          label="Description" prefix="description" multiline rows={4}
          values={form} onChange={set} lang={lang} onLangChange={setLang}
        />
        <LocalizedField
          label="Location" prefix="location"
          values={form} onChange={set} lang={lang} onLangChange={setLang}
        />

        <div className="grid sm:grid-cols-3 gap-4">
          <TextField
            label="Date" type="date" required
            value={form.date} error={errors.date}
            onChange={e => set('date', e.target.value)}
          />
          <TextField
            label="Start time" type="time"
            value={form.time || ''}
            onChange={e => set('time', e.target.value)}
          />
          <TextField
            label="Seats" type="number" min={0}
            hint="0 means no limit"
            value={form.max_participants} error={errors.max_participants}
            onChange={e => set('max_participants', e.target.value === '' ? 0 : Number(e.target.value))}
          />
        </div>

        <div>
          <span className="adm-label">Poster</span>
          <div className="flex items-center gap-3">
            <label className="adm-btn" style={{ cursor: uploading ? 'wait' : 'pointer' }}>
              {uploading ? <Loader2 size={15} className="adm-spin" /> : <Upload size={15} />}
              {uploading ? `Uploading ${uploading}%` : form.poster_url ? 'Replace image' : 'Upload image'}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={!!uploading}
                onChange={e => { upload(e.target.files?.[0]); e.target.value = '' }}
              />
            </label>
            {form.poster_url && (
              <div className="flex items-center gap-2">
                <img
                  src={form.poster_url}
                  alt="Event poster preview"
                  className="rounded-lg object-cover"
                  style={{ width: 52, height: 52, border: '1px solid var(--adm-trace)' }}
                />
                <button
                  type="button"
                  onClick={() => set('poster_url', '')}
                  className="text-[13px] font-medium"
                  style={{ color: 'var(--adm-fault)' }}
                >
                  Remove
                </button>
              </div>
            )}
          </div>
        </div>

        <div
          className="flex flex-col gap-3 pt-4"
          style={{ borderTop: '1px solid var(--adm-trace)' }}
        >
          <CheckField
            label="Published"
            description="Show this event on the public site."
            checked={form.is_published}
            onChange={v => set('is_published', v)}
          />
          <CheckField
            label="Registration open"
            description="Let visitors sign up. Each sign-up needs approving before a seat is confirmed."
            checked={form.registration_open}
            onChange={v => set('registration_open', v)}
          />
          {form.registration_open && !form.is_published && (
            <p className="flex items-center gap-2 text-xs" style={{ color: 'var(--adm-wait)' }}>
              <Badge tone="wait">Heads up</Badge>
              Registration is open but the event is not published, so nobody can reach the form.
            </p>
          )}
        </div>
      </div>
    </Modal>
  )
}
