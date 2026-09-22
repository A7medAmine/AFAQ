import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, ClipboardCheck, Download, Loader2, QrCode, X } from 'lucide-react'
import { api, logActivity, read, run, supabase } from '../lib/db'
import useAdminStore from '../store/adminStore'
import useCounts from '../hooks/useCounts'
import useQueryParam from '../hooks/useQueryParam'
import { downloadDataUrl, formatDate, formatDateTime } from '../lib/format'
import PageHeader, { FilterTabs } from '../components/ui/PageHeader'
import DataTable from '../components/ui/DataTable'
import Drawer, { DetailRow, TagList } from '../components/ui/Drawer'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import EmptyState, { ErrorState } from '../components/ui/EmptyState'
import Button, { IconButton } from '../components/ui/Button'
import ExportMenu from '../components/ui/ExportMenu'
import { StatusBadge } from '../components/ui/Badge'
import Panel from '../components/ui/Panel'

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
]

export default function RegistrationsPage() {
  const addToast = useAdminStore(s => s.addToast)
  const { refresh: refreshCounts } = useCounts()

  const [rows, setRows] = useState([])
  const [state, setState] = useState({ loading: true, error: null })
  const [status, setStatus] = useQueryParam('status', 'all')
  const [eventId, setEventId] = useQueryParam('event', 'all')
  const [search] = useQueryParam('q')

  const [detail, setDetail] = useState(null)
  const [qrFor, setQrFor] = useState(null)
  const [bulk, setBulk] = useState(null)      // { action, rows }
  const [working, setWorking] = useState({})

  const load = useCallback(async () => {
    setState(s => ({ ...s, error: null }))
    // The old page fetched the event title and then never rendered it, so you
    // could not tell which event a registration belonged to.
    const { ok, data, message } = await read(
      supabase
        .from('event_registrations')
        .select('*, event:events(id, title_en, date)')
        .order('created_at', { ascending: false })
    )
    if (!ok) { setState({ loading: false, error: message }); return }
    setRows(data || [])
    setState({ loading: false, error: null })
  }, [])

  useEffect(() => { load() }, [load])

  const events = useMemo(() => {
    const seen = new Map()
    for (const row of rows) if (row.event) seen.set(row.event.id, row.event)
    return [...seen.values()].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  }, [rows])

  const filtered = useMemo(
    () => rows.filter(r =>
      (status === 'all' || r.status === status) &&
      (eventId === 'all' || String(r.event_id) === String(eventId))
    ),
    [rows, status, eventId]
  )

  const filterOptions = FILTERS.map(f => ({
    ...f,
    count: f.value === 'all' ? rows.length : rows.filter(r => r.status === f.value).length,
  }))

  /**
   * Approving goes through the server so the confirmation email and QR pass get
   * issued; every other status is a plain update.
   */
  const setStatusFor = async (row, next) => {
    setWorking(w => ({ ...w, [row.id]: true }))

    if (next === 'approved') {
      const { ok, message } = await api('/api/approve/registration', { method: 'POST', body: { id: row.id } })
      setWorking(w => ({ ...w, [row.id]: false }))
      if (!ok) { addToast(message, 'error'); return false }
      addToast(`${row.full_name} approved. Their pass is on the way by email.`)
    } else {
      const { ok } = await run(
        supabase.from('event_registrations').update({ status: next }).eq('id', row.id),
        { success: `${row.full_name} marked ${next}.`, failure: 'The status did not change.' }
      )
      setWorking(w => ({ ...w, [row.id]: false }))
      if (!ok) return false
    }

    logActivity(next, 'event_registrations', row.id, { name: row.full_name })
    await load()
    refreshCounts()
    return true
  }

  const runBulk = async () => {
    const { action, rows: targets } = bulk
    const pending = targets.filter(r => r.status === 'pending')
    if (!pending.length) {
      addToast('None of the selected rows are still pending.', 'info')
      setBulk(null)
      return
    }

    let done = 0
    for (const row of pending) {
      if (action === 'approve') {
        const { ok } = await api('/api/approve/registration', { method: 'POST', body: { id: row.id } })
        if (ok) done += 1
      } else {
        const { error } = await supabase.from('event_registrations').update({ status: 'rejected' }).eq('id', row.id)
        if (!error) done += 1
      }
    }

    const verb = action === 'approve' ? 'approved' : 'rejected'
    if (done === pending.length) addToast(`${done} ${done === 1 ? 'person' : 'people'} ${verb}.`)
    else addToast(`${done} of ${pending.length} ${verb}. The rest failed — try them individually.`, 'warning')

    setBulk(null)
    await load()
    refreshCounts()
  }

  const exportHeaders = ['Name', 'Email', 'Phone', 'Student ID', 'Department', 'Study year', 'Event', 'Skills', 'Interests', 'Motivation', 'Status', 'Registered']
  const exportRows = filtered.map(r => [
    r.full_name, r.email, r.phone, r.student_id, r.department, r.study_year,
    r.event?.title_en, r.skills, r.interests, r.motivation, r.status, formatDateTime(r.created_at),
  ])

  const columns = useMemo(() => [
    {
      header: 'Name',
      accessorKey: 'full_name',
      cell: ({ row }) => (
        <span className="min-w-0 block">
          <span className="block text-sm font-semibold adm-truncate" style={{ maxWidth: 200 }}>
            {row.original.full_name}
          </span>
          <span className="adm-data block text-[11px] adm-truncate" style={{ color: 'var(--adm-silk-faint)', maxWidth: 200 }}>
            {row.original.email}
          </span>
        </span>
      ),
    },
    {
      header: 'Event',
      id: 'event',
      accessorFn: row => row.event?.title_en || '',
      cell: ({ row }) => (
        <span className="text-[13px] adm-truncate block" style={{ maxWidth: 200, color: 'var(--adm-silk-dim)' }}>
          {row.original.event?.title_en || <span style={{ color: 'var(--adm-silk-faint)' }}>Deleted event</span>}
        </span>
      ),
    },
    { header: 'Department', accessorKey: 'department', cell: ({ row }) => (
      <span className="text-[13px]" style={{ color: 'var(--adm-silk-dim)' }}>{row.original.department || '—'}</span>
    )},
    { header: 'Status', accessorKey: 'status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    {
      header: 'Registered',
      accessorKey: 'created_at',
      cell: ({ row }) => <span className="adm-data text-[12px]">{formatDate(row.original.created_at)}</span>,
    },
    {
      header: '',
      id: 'actions',
      enableSorting: false,
      cell: ({ row }) => {
        const r = row.original
        const busy = working[r.id]
        return (
          <div className="flex items-center justify-end gap-0.5" onClick={e => e.stopPropagation()}>
            {busy && <Loader2 size={14} className="adm-spin mr-1" style={{ color: 'var(--adm-silk-faint)' }} />}
            {r.status === 'approved' && r.qr_code && (
              <IconButton icon={QrCode} label="Show entry pass" onClick={() => setQrFor(r)} />
            )}
            {r.status === 'pending' && (
              <>
                <IconButton icon={Check} label="Approve" disabled={busy} onClick={() => setStatusFor(r, 'approved')} />
                <IconButton icon={X} label="Reject" danger disabled={busy} onClick={() => setStatusFor(r, 'rejected')} />
              </>
            )}
          </div>
        )
      },
    },
  ], [working]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <PageHeader
        eyebrow="Operate"
        title="Event registrations"
        description="Approving a registration emails the person their entry pass. Open a row to read what they submitted."
        actions={
          <ExportMenu
            filename={`registrations-${status}-${new Date().toISOString().slice(0, 10)}`}
            title="Event registrations"
            subtitle={`${FILTERS.find(f => f.value === status)?.label || 'All'} · ${formatDateTime(new Date())}`}
            headers={exportHeaders}
            rows={exportRows}
            statusColumnIndex={10}
            disabled={!filtered.length}
          />
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
          onRowClick={setDetail}
          enableSelection
          searchPlaceholder="Search by name, email, department…"
          toolbar={
            <>
              <FilterTabs options={filterOptions} value={status} onChange={setStatus} label="Status filter" />
              {events.length > 1 && (
                <select
                  className="adm-input"
                  style={{ width: 'auto', minWidth: 180 }}
                  value={eventId}
                  onChange={e => setEventId(e.target.value)}
                  aria-label="Filter by event"
                >
                  <option value="all">Every event</option>
                  {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title_en}</option>)}
                </select>
              )}
            </>
          }
          bulkActions={selected => {
            const pending = selected.filter(r => r.status === 'pending').length
            return (
              <>
                <Button
                  size="sm" variant="primary" icon={Check} disabled={!pending}
                  onClick={() => setBulk({ action: 'approve', rows: selected })}
                >
                  Approve {pending || ''}
                </Button>
                <Button
                  size="sm" icon={X} disabled={!pending}
                  onClick={() => setBulk({ action: 'reject', rows: selected })}
                >
                  Reject
                </Button>
              </>
            )
          }}
          emptyState={
            rows.length === 0 ? (
              <EmptyState
                icon={ClipboardCheck}
                title="No registrations yet"
                description="Open registration on a published event and sign-ups will land here."
              />
            ) : (
              <EmptyState compact icon={ClipboardCheck} title="Nothing in this view" description="Try another status or event." />
            )
          }
        />
      )}

      <RegistrationDrawer
        registration={detail}
        onClose={() => setDetail(null)}
        onStatus={async (row, next) => { const ok = await setStatusFor(row, next); if (ok) setDetail(null) }}
        onShowPass={setQrFor}
        busy={detail ? working[detail.id] : false}
      />

      <Modal open={!!qrFor} onClose={() => setQrFor(null)} size="sm" title="Entry pass">
        {qrFor && (
          <div className="flex flex-col items-center text-center gap-4">
            <img
              src={qrFor.qr_code}
              alt={`Entry pass QR code for ${qrFor.full_name}`}
              style={{ width: 200, height: 200, borderRadius: 12, border: '1px solid var(--adm-trace)' }}
            />
            <div>
              <p className="text-sm font-semibold">{qrFor.full_name}</p>
              <p className="adm-data text-xs" style={{ color: 'var(--adm-silk-faint)' }}>{qrFor.email}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--adm-silk-faint)' }}>{qrFor.event?.title_en}</p>
            </div>
            <Button
              icon={Download}
              onClick={() => downloadDataUrl(qrFor.qr_code, `pass-${qrFor.full_name.replace(/\s+/g, '-')}.png`)}
            >
              Download pass
            </Button>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!bulk}
        onClose={() => setBulk(null)}
        onConfirm={runBulk}
        danger={bulk?.action === 'reject'}
        title={bulk?.action === 'approve' ? 'Approve these registrations?' : 'Reject these registrations?'}
        confirmLabel={bulk?.action === 'approve' ? 'Approve all' : 'Reject all'}
        busyLabel={bulk?.action === 'approve' ? 'Approving…' : 'Rejecting…'}
        message={
          bulk
            ? bulk.action === 'approve'
              ? `${bulk.rows.filter(r => r.status === 'pending').length} people will be approved and emailed their entry pass. Rows that are not pending are skipped.`
              : `${bulk.rows.filter(r => r.status === 'pending').length} registrations will be rejected. No email is sent.`
            : ''
        }
      />
    </div>
  )
}

/** Everything the applicant actually wrote — none of it was visible before. */
function RegistrationDrawer({ registration, onClose, onStatus, onShowPass, busy }) {
  const r = registration
  return (
    <Drawer
      open={!!r}
      onClose={onClose}
      title={r?.full_name || ''}
      subtitle={r?.event?.title_en ? `Registered for ${r.event.title_en}` : 'Event no longer exists'}
      badge={r && <StatusBadge status={r.status} />}
      footer={
        r && (
          <>
            {r.status === 'approved' && r.qr_code && (
              <Button icon={QrCode} onClick={() => onShowPass(r)}>Entry pass</Button>
            )}
            {r.status === 'pending' && (
              <>
                <Button icon={X} onClick={() => onStatus(r, 'rejected')} disabled={busy}>Reject</Button>
                <Button variant="primary" icon={Check} onClick={() => onStatus(r, 'approved')} busy={busy} busyLabel="Approving…">
                  Approve
                </Button>
              </>
            )}
          </>
        )
      }
    >
      {r && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <DetailRow label="Email" mono>{r.email}</DetailRow>
            <DetailRow label="Phone" mono>{r.phone || '—'}</DetailRow>
            <DetailRow label="Student ID" mono>{r.student_id || '—'}</DetailRow>
            <DetailRow label="Study year">{r.study_year || '—'}</DetailRow>
            <DetailRow label="Department">{r.department || '—'}</DetailRow>
            <DetailRow label="Registered" mono>{formatDateTime(r.created_at)}</DetailRow>
          </div>

          <DetailRow label="Skills"><TagList items={r.skills} empty="None listed" /></DetailRow>
          <DetailRow label="Interests"><TagList items={r.interests} empty="None listed" /></DetailRow>

          <DetailRow label="Why they want to come">
            {r.motivation
              ? <p className="whitespace-pre-wrap leading-relaxed">{r.motivation}</p>
              : <span style={{ color: 'var(--adm-silk-faint)' }}>They left this blank.</span>}
          </DetailRow>

          <DetailRow label="Policies">
            {r.agreed_to_policies ? 'Agreed to the club policies' : 'Did not agree to the club policies'}
          </DetailRow>
        </div>
      )}
    </Drawer>
  )
}
