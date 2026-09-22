import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCheck, Mail, MailOpen, Reply, Trash2 } from 'lucide-react'
import { read, run, supabase } from '../lib/db'
import useAdminStore from '../store/adminStore'
import useCounts from '../hooks/useCounts'
import useQueryParam from '../hooks/useQueryParam'
import { formatDateTime, relativeTime } from '../lib/format'
import PageHeader, { FilterTabs } from '../components/ui/PageHeader'
import DataTable from '../components/ui/DataTable'
import Drawer, { DetailRow } from '../components/ui/Drawer'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import EmptyState, { ErrorState } from '../components/ui/EmptyState'
import Button, { IconButton } from '../components/ui/Button'
import ExportMenu from '../components/ui/ExportMenu'
import Panel from '../components/ui/Panel'

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'read', label: 'Read' },
]

export default function MessagesPage() {
  const addToast = useAdminStore(s => s.addToast)
  const { refresh: refreshCounts } = useCounts()

  const [rows, setRows] = useState([])
  const [state, setState] = useState({ loading: true, error: null })
  const [status, setStatus] = useQueryParam('status', 'all')
  const [search] = useQueryParam('q')
  const [reading, setReading] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)

  const load = useCallback(async () => {
    setState(s => ({ ...s, error: null }))
    const { ok, data, message } = await read(
      supabase.from('contact_messages').select('*').order('created_at', { ascending: false })
    )
    if (!ok) { setState({ loading: false, error: message }); return }
    setRows(data || [])
    setState({ loading: false, error: null })
  }, [])

  useEffect(() => { load() }, [load])

  const unread = rows.filter(r => !r.is_read)

  const filtered = useMemo(() => {
    if (status === 'unread') return rows.filter(r => !r.is_read)
    if (status === 'read') return rows.filter(r => r.is_read)
    return rows
  }, [rows, status])

  const filterOptions = FILTERS.map(f => ({
    ...f,
    count: f.value === 'all' ? rows.length : f.value === 'unread' ? unread.length : rows.length - unread.length,
  }))

  const setRead = async (message, isRead, { silent = false } = {}) => {
    const { ok } = await run(
      supabase.from('contact_messages').update({ is_read: isRead }).eq('id', message.id),
      silent ? {} : { success: isRead ? 'Marked as read.' : 'Marked as unread.', failure: 'That did not change.' }
    )
    if (ok) {
      setRows(list => list.map(m => (m.id === message.id ? { ...m, is_read: isRead } : m)))
      refreshCounts()
    }
  }

  /** Opening a message is reading it — no separate step. */
  const open = message => {
    setReading(message)
    if (!message.is_read) setRead(message, true, { silent: true })
  }

  const markAllRead = async () => {
    const ids = unread.map(m => m.id)
    if (!ids.length) return
    const { ok } = await run(
      supabase.from('contact_messages').update({ is_read: true }).in('id', ids),
      { success: `${ids.length} ${ids.length === 1 ? 'message' : 'messages'} marked as read.`, failure: 'Not all messages changed.' }
    )
    if (ok) { load(); refreshCounts() }
  }

  const remove = async () => {
    const targets = Array.isArray(pendingDelete) ? pendingDelete : [pendingDelete]
    const ids = targets.map(m => m.id)
    const { ok } = await run(
      supabase.from('contact_messages').delete().in('id', ids),
      {
        success: ids.length === 1 ? 'Message deleted.' : `${ids.length} messages deleted.`,
        failure: 'The messages were not deleted.',
      }
    )
    if (ok) {
      setPendingDelete(null)
      setReading(null)
      load()
      refreshCounts()
    }
  }

  const columns = useMemo(() => [
    {
      header: 'From',
      accessorKey: 'name',
      cell: ({ row }) => (
        <span className="flex items-center gap-2.5 min-w-0">
          <span
            className="rounded-full shrink-0"
            style={{ width: 7, height: 7, background: row.original.is_read ? 'transparent' : 'var(--adm-signal)' }}
            aria-label={row.original.is_read ? undefined : 'Unread'}
          />
          <span className="min-w-0">
            <span
              className="block text-sm adm-truncate"
              style={{ maxWidth: 180, fontWeight: row.original.is_read ? 500 : 700 }}
            >
              {row.original.name}
            </span>
            <span className="adm-data block text-[11px] adm-truncate" style={{ color: 'var(--adm-silk-faint)', maxWidth: 180 }}>
              {row.original.email}
            </span>
          </span>
        </span>
      ),
    },
    {
      header: 'Subject',
      accessorKey: 'subject',
      cell: ({ row }) => (
        <span className="min-w-0 block">
          <span
            className="block text-sm adm-truncate"
            style={{ maxWidth: 320, fontWeight: row.original.is_read ? 400 : 650 }}
          >
            {row.original.subject}
          </span>
          <span className="block text-xs adm-truncate" style={{ color: 'var(--adm-silk-faint)', maxWidth: 320 }}>
            {row.original.message}
          </span>
        </span>
      ),
    },
    {
      header: 'Received',
      accessorKey: 'created_at',
      cell: ({ row }) => (
        <span className="adm-data text-[12px]" title={formatDateTime(row.original.created_at)}>
          {relativeTime(row.original.created_at)}
        </span>
      ),
    },
    {
      header: '',
      id: 'actions',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-0.5" onClick={e => e.stopPropagation()}>
          <IconButton
            icon={row.original.is_read ? Mail : MailOpen}
            label={row.original.is_read ? 'Mark as unread' : 'Mark as read'}
            onClick={() => setRead(row.original, !row.original.is_read)}
          />
          <IconButton icon={Trash2} label="Delete" danger onClick={() => setPendingDelete(row.original)} />
        </div>
      ),
    },
  ], []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <PageHeader
        eyebrow="Operate"
        title="Messages"
        description="Everything sent through the contact form. Opening a message marks it read."
        actions={
          <>
            <ExportMenu
              filename={`messages-${status}-${new Date().toISOString().slice(0, 10)}`}
              title="Messages"
              subtitle={`${FILTERS.find(f => f.value === status)?.label || 'All'} · ${formatDateTime(new Date())}`}
              headers={['Name', 'Email', 'Subject', 'Message', 'Status', 'Received']}
              rows={filtered.map(m => [m.name, m.email, m.subject, m.message, m.is_read ? 'read' : 'unread', formatDateTime(m.created_at)])}
              statusColumnIndex={4}
              disabled={!filtered.length}
            />
            <Button icon={CheckCheck} onClick={markAllRead} disabled={!unread.length}>
              Mark all read{unread.length ? ` (${unread.length})` : ''}
            </Button>
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
          onRowClick={open}
          enableSelection
          searchPlaceholder="Search sender, subject, message…"
          initialSort={[{ id: 'created_at', desc: true }]}
          toolbar={<FilterTabs options={filterOptions} value={status} onChange={setStatus} label="Message filter" />}
          bulkActions={selected => (
            <Button size="sm" variant="danger" icon={Trash2} onClick={() => setPendingDelete(selected)}>
              Delete {selected.length}
            </Button>
          )}
          emptyState={
            rows.length === 0 ? (
              <EmptyState
                icon={Mail}
                title="No messages yet"
                description="When someone writes in through the contact form on the website, it arrives here."
              />
            ) : (
              <EmptyState compact icon={Mail} title="Nothing in this view" description="Try another filter." />
            )
          }
        />
      )}

      <Drawer
        open={!!reading}
        onClose={() => setReading(null)}
        title={reading?.subject || ''}
        subtitle={reading ? `${reading.name} · ${formatDateTime(reading.created_at)}` : ''}
        width={560}
        footer={
          reading && (
            <>
              <Button
                icon={Trash2}
                onClick={() => setPendingDelete(reading)}
                style={{ color: 'var(--adm-fault)' }}
              >
                Delete
              </Button>
              <Button
                variant="primary"
                icon={Reply}
                onClick={() => {
                  // Replying happens in the admin's own mail client — the club
                  // has no outbound inbox to thread against.
                  window.location.href = `mailto:${reading.email}?subject=${encodeURIComponent(`Re: ${reading.subject}`)}`
                }}
              >
                Reply by email
              </Button>
            </>
          )
        }
      >
        {reading && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <DetailRow label="Name">{reading.name}</DetailRow>
              <DetailRow label="Email" mono>{reading.email}</DetailRow>
            </div>
            <DetailRow label="Message">
              <p className="whitespace-pre-wrap leading-relaxed">{reading.message}</p>
            </DetailRow>
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={remove}
        title={Array.isArray(pendingDelete) ? 'Delete these messages?' : 'Delete this message?'}
        confirmLabel={Array.isArray(pendingDelete) ? `Delete ${pendingDelete.length}` : 'Delete message'}
        message={
          Array.isArray(pendingDelete)
            ? `${pendingDelete.length} messages will be removed. This cannot be undone.`
            : pendingDelete
              ? `The message from ${pendingDelete.name} will be removed. This cannot be undone.`
              : ''
        }
      />
    </div>
  )
}
