import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeftRight, Camera, PackageCheck, PackageMinus, ScrollText } from 'lucide-react'
import { logActivity, read, run, supabase } from '../lib/db'
import useAdminStore from '../store/adminStore'
import PageHeader, { FilterTabs } from '../components/ui/PageHeader'
import DataTable from '../components/ui/DataTable'
import EmptyState, { ErrorState } from '../components/ui/EmptyState'
import Panel from '../components/ui/Panel'
import Button from '../components/ui/Button'
import ExportMenu from '../components/ui/ExportMenu'
import { StatusBadge } from '../components/ui/Badge'
import { TextArea, TextField } from '../components/ui/Field'
import QrScanner from '../components/ui/QrScanner'
import { formatDate, formatDateTime } from '../lib/format'

const TABS = [
  { value: 'checkout', label: 'Check out' },
  { value: 'return', label: 'Return' },
  { value: 'history', label: 'History' },
]

export default function BorrowingPage() {
  const [tab, setTab] = useState('checkout')
  const [rows, setRows] = useState([])
  const [state, setState] = useState({ loading: true, error: null })

  const load = useCallback(async () => {
    setState(s => ({ ...s, error: null }))
    const { ok, data, message } = await read(
      supabase
        .from('borrow_records')
        .select('*, item:inventory_items(name, asset_code), member:members(full_name)')
        .order('checked_out_at', { ascending: false })
    )
    if (!ok) { setState({ loading: false, error: message }); return }
    setRows(data || [])
    setState({ loading: false, error: null })
  }, [])

  useEffect(() => { load() }, [load])

  const now = Date.now()
  const withOverdue = useMemo(() => rows.map(r => ({
    ...r,
    computedStatus: r.status === 'active' && r.expected_return_at && new Date(r.expected_return_at).getTime() < now
      ? 'overdue'
      : r.status,
  })), [rows, now])

  const activeCount = rows.filter(r => r.status === 'active').length
  const overdueCount = withOverdue.filter(r => r.computedStatus === 'overdue').length

  return (
    <div>
      <PageHeader
        eyebrow="Operate"
        title="Borrowing"
        description="Check tools and equipment in and out by scanning the item's QR label and the member's card."
        actions={tab === 'history' && (
          <ExportMenu
            filename={`borrowing-history-${new Date().toISOString().slice(0, 10)}`}
            title="Borrowing history"
            subtitle={formatDateTime(new Date())}
            headers={['Item', 'Asset code', 'Borrower', 'Checked out', 'Due', 'Returned', 'Status']}
            rows={withOverdue.map(r => [
              r.item?.name, r.item?.asset_code, r.member?.full_name || r.borrower_name,
              formatDateTime(r.checked_out_at), r.expected_return_at ? formatDate(r.expected_return_at) : '',
              r.returned_at ? formatDateTime(r.returned_at) : '', r.computedStatus,
            ])}
            statusColumnIndex={6}
            disabled={!withOverdue.length}
          />
        )}
      />

      <div className="flex items-center gap-4 mb-6">
        <FilterTabs
          options={TABS.map(t => ({ ...t }))}
          value={tab}
          onChange={setTab}
          label="Section"
        />
        {activeCount > 0 && (
          <span className="text-xs" style={{ color: 'var(--adm-silk-faint)' }}>
            {activeCount} out{overdueCount > 0 ? `, ${overdueCount} overdue` : ''}
          </span>
        )}
      </div>

      {tab === 'checkout' && <CheckOutForm onDone={() => { load(); setTab('history') }} />}
      {tab === 'return' && <ReturnForm onDone={() => { load(); setTab('history') }} />}
      {tab === 'history' && (
        state.error ? (
          <Panel><ErrorState message={state.error} onRetry={load} /></Panel>
        ) : (
          <HistoryTable rows={withOverdue} loading={state.loading} />
        )
      )}
    </div>
  )
}

function CodeInput({ label, value, onChange, onScan, placeholder }) {
  return (
    <div className="flex items-end gap-2">
      <TextField label={label} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="flex-1" />
      <Button type="button" onClick={onScan} icon={Camera}>Scan</Button>
    </div>
  )
}

function CheckOutForm({ onDone }) {
  const addToast = useAdminStore(s => s.addToast)
  const [assetCode, setAssetCode] = useState('')
  const [memberCode, setMemberCode] = useState('')
  const [expectedReturn, setExpectedReturn] = useState('')
  const [note, setNote] = useState('')
  const [scanning, setScanning] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!assetCode.trim()) { addToast('Scan or type the item code.', 'error'); return }
    setBusy(true)

    const { data: item, error: itemErr } = await supabase
      .from('inventory_items').select('*').eq('asset_code', assetCode.trim()).maybeSingle()
    if (itemErr || !item) { addToast('No item with that code.', 'error'); setBusy(false); return }
    if (item.status !== 'available') { addToast(`${item.name} is not available (${item.status}).`, 'error'); setBusy(false); return }

    let member = null
    if (memberCode.trim()) {
      const { data } = await supabase
        .from('members').select('id, full_name').eq('member_code', memberCode.trim()).maybeSingle()
      member = data
      if (!member) { addToast('No member with that code.', 'error'); setBusy(false); return }
    }

    const { error: insertErr } = await supabase.from('borrow_records').insert({
      item_id: item.id,
      member_id: member?.id ?? null,
      borrower_name: member?.full_name ?? null,
      expected_return_at: expectedReturn ? new Date(expectedReturn).toISOString() : null,
      condition_note_out: note.trim() || null,
      status: 'active',
    })
    if (insertErr) { addToast('The checkout was not recorded.', 'error'); setBusy(false); return }

    await supabase.from('inventory_items').update({ status: 'borrowed' }).eq('id', item.id)
    logActivity('checked_out', 'inventory_items', item.id, { name: item.name, borrower: member?.full_name })

    addToast(`${item.name} checked out${member ? ` to ${member.full_name}` : ''}.`)
    setAssetCode(''); setMemberCode(''); setExpectedReturn(''); setNote('')
    setBusy(false)
    onDone()
  }

  return (
    <Panel>
      <div className="space-y-4 max-w-md">
        <CodeInput label="Item asset code" value={assetCode} onChange={setAssetCode} onScan={() => setScanning('item')} placeholder="INV-00001" />
        <CodeInput label="Member code (optional)" value={memberCode} onChange={setMemberCode} onScan={() => setScanning('member')} placeholder="AFQ-00001" />
        <TextField label="Expected return date" type="date" value={expectedReturn} onChange={e => setExpectedReturn(e.target.value)} />
        <TextArea label="Condition notes" value={note} onChange={e => setNote(e.target.value)} placeholder="Working, minor scuff on the case…" />
        <Button variant="primary" icon={PackageMinus} busy={busy} busyLabel="Checking out…" onClick={submit}>Check out</Button>
      </div>

      <QrScanner
        open={!!scanning}
        onClose={() => setScanning(null)}
        title={scanning === 'item' ? 'Scan item QR' : 'Scan member card'}
        onResult={code => { scanning === 'item' ? setAssetCode(code) : setMemberCode(code); setScanning(null) }}
      />
    </Panel>
  )
}

function ReturnForm({ onDone }) {
  const addToast = useAdminStore(s => s.addToast)
  const [assetCode, setAssetCode] = useState('')
  const [note, setNote] = useState('')
  const [scanning, setScanning] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!assetCode.trim()) { addToast('Scan or type the item code.', 'error'); return }
    setBusy(true)

    const { data: item, error: itemErr } = await supabase
      .from('inventory_items').select('*').eq('asset_code', assetCode.trim()).maybeSingle()
    if (itemErr || !item) { addToast('No item with that code.', 'error'); setBusy(false); return }

    const { data: record } = await supabase
      .from('borrow_records').select('*').eq('item_id', item.id).eq('status', 'active')
      .order('checked_out_at', { ascending: false }).limit(1).maybeSingle()
    if (!record) { addToast(`${item.name} is not checked out.`, 'error'); setBusy(false); return }

    await supabase.from('borrow_records').update({
      status: 'returned', returned_at: new Date().toISOString(), condition_note_in: note.trim() || null,
    }).eq('id', record.id)
    await supabase.from('inventory_items').update({ status: 'available' }).eq('id', item.id)
    logActivity('returned', 'inventory_items', item.id, { name: item.name })

    addToast(`${item.name} marked returned.`)
    setAssetCode(''); setNote('')
    setBusy(false)
    onDone()
  }

  return (
    <Panel>
      <div className="space-y-4 max-w-md">
        <CodeInput label="Item asset code" value={assetCode} onChange={setAssetCode} onScan={() => setScanning(true)} placeholder="INV-00001" />
        <TextArea label="Return condition notes" value={note} onChange={e => setNote(e.target.value)} placeholder="Returned in good condition…" />
        <Button variant="primary" icon={PackageCheck} busy={busy} busyLabel="Returning…" onClick={submit}>Mark returned</Button>
      </div>

      <QrScanner
        open={scanning}
        onClose={() => setScanning(false)}
        title="Scan item QR"
        onResult={code => { setAssetCode(code); setScanning(false) }}
      />
    </Panel>
  )
}

function HistoryTable({ rows, loading }) {
  const columns = useMemo(() => [
    { header: 'Item', accessorKey: 'item.name', cell: ({ row }) => (
      <span className="min-w-0 block">
        <span className="block text-sm font-semibold adm-truncate" style={{ maxWidth: 200 }}>{row.original.item?.name || '—'}</span>
        <span className="adm-data block text-[11px]" style={{ color: 'var(--adm-silk-faint)' }}>{row.original.item?.asset_code}</span>
      </span>
    )},
    { header: 'Borrower', accessorKey: 'borrower_name', cell: ({ row }) => (
      <span className="text-[13px]" style={{ color: 'var(--adm-silk-dim)' }}>
        {row.original.member?.full_name || row.original.borrower_name || '—'}
      </span>
    )},
    { header: 'Checked out', accessorKey: 'checked_out_at', cell: ({ row }) => (
      <span className="adm-data text-[12px]">{formatDateTime(row.original.checked_out_at)}</span>
    )},
    { header: 'Due', accessorKey: 'expected_return_at', cell: ({ row }) => (
      <span className="adm-data text-[12px]">{row.original.expected_return_at ? formatDate(row.original.expected_return_at) : '—'}</span>
    )},
    { header: 'Returned', accessorKey: 'returned_at', cell: ({ row }) => (
      <span className="adm-data text-[12px]">{row.original.returned_at ? formatDateTime(row.original.returned_at) : '—'}</span>
    )},
    { header: 'Status', accessorKey: 'computedStatus', cell: ({ row }) => <StatusBadge status={row.original.computedStatus} /> },
  ], [])

  return (
    <DataTable
      columns={columns}
      data={rows}
      loading={loading}
      getRowId={row => String(row.id)}
      searchPlaceholder="Search by item or borrower…"
      emptyState={<EmptyState icon={ScrollText} title="No borrow history yet" description="Check out an item to start the log." />}
    />
  )
}
