import { useCallback, useEffect, useMemo, useState } from 'react'
import { PackageCheck, PackageMinus, ScrollText } from 'lucide-react'
import { logActivity, read, supabase } from '../lib/db'
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
import SearchPicker, { normalizeCode } from '../components/ui/SearchPicker'
import { formatDate, formatDateTime } from '../lib/format'

const TABS = [
  { value: 'checkout', label: 'Check out' },
  { value: 'return', label: 'Return' },
  { value: 'history', label: 'History' },
]

// A due date picked as "YYYY-MM-DD" means the end of that day locally —
// `new Date('YYYY-MM-DD')` is UTC midnight and flagged loans overdue early.
function endOfDay(dateString) {
  return new Date(`${dateString}T23:59:59`).toISOString()
}

function isOverdue(record, now = Date.now()) {
  return record.status === 'active' && record.expected_return_at && new Date(record.expected_return_at).getTime() < now
}

export default function BorrowingPage() {
  const [tab, setTab] = useState('checkout')
  const [rows, setRows] = useState([])
  const [items, setItems] = useState([])
  const [members, setMembers] = useState([])
  const [state, setState] = useState({ loading: true, error: null })

  const load = useCallback(async () => {
    setState(s => ({ ...s, error: null }))
    const [records, itemList, memberList] = await Promise.all([
      read(
        supabase
          .from('borrow_records')
          .select('*, item:inventory_items(id, name, asset_code, category, location, status), member:members(full_name, member_code)')
          .order('checked_out_at', { ascending: false })
      ),
      read(
        supabase.from('inventory_items')
          .select('id, name, asset_code, category, location, status')
          .neq('status', 'retired')
          .order('name')
      ),
      read(supabase.from('members').select('id, full_name, member_code, department').order('full_name')),
    ])
    const failed = [records, itemList, memberList].find(r => !r.ok)
    if (failed) { setState({ loading: false, error: failed.message }); return }
    setRows(records.data || [])
    setItems(itemList.data || [])
    setMembers(memberList.data || [])
    setState({ loading: false, error: null })
  }, [])

  useEffect(() => { load() }, [load])

  const withOverdue = useMemo(() => {
    const now = Date.now()
    return rows.map(r => ({ ...r, computedStatus: isOverdue(r, now) ? 'overdue' : r.status }))
  }, [rows])

  const activeLoans = useMemo(() => withOverdue.filter(r => r.status === 'active' && r.item), [withOverdue])
  const overdueCount = activeLoans.filter(r => r.computedStatus === 'overdue').length

  return (
    <div>
      <PageHeader
        eyebrow="Operate"
        title="Borrowing"
        description="Check tools and equipment in and out. Search by name, type a code, or scan the item's label and the member's card."
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
        {activeLoans.length > 0 && (
          <span className="text-xs" style={{ color: overdueCount ? 'var(--adm-fault)' : 'var(--adm-silk-faint)' }}>
            {activeLoans.length} out{overdueCount > 0 ? `, ${overdueCount} overdue` : ''}
          </span>
        )}
      </div>

      {state.error ? (
        <Panel><ErrorState message={state.error} onRetry={load} /></Panel>
      ) : (
        <>
          {tab === 'checkout' && <CheckOutForm items={items} members={members} loading={state.loading} onDone={load} />}
          {tab === 'return' && <ReturnForm loans={activeLoans} items={items} loading={state.loading} onDone={load} />}
          {tab === 'history' && <HistoryTable rows={withOverdue} loading={state.loading} />}
        </>
      )}
    </div>
  )
}

function ItemOption({ item }) {
  return (
    <span className="min-w-0 block">
      <span className="block text-sm font-semibold adm-truncate">{item.name}</span>
      <span className="adm-data block text-[11px] adm-truncate" style={{ color: 'var(--adm-silk-faint)' }}>
        {[item.asset_code, item.category, item.location].filter(Boolean).join(' · ')}
      </span>
    </span>
  )
}

function MemberOption({ member }) {
  return (
    <span className="min-w-0 block">
      <span className="block text-sm font-semibold adm-truncate">{member.full_name}</span>
      <span className="adm-data block text-[11px] adm-truncate" style={{ color: 'var(--adm-silk-faint)' }}>
        {member.guest ? 'Guest, not a member' : [member.member_code, member.department].filter(Boolean).join(' · ')}
      </span>
    </span>
  )
}

const itemKey = i => i.id
const itemCode = i => i.asset_code
const itemText = i => [i.name, i.asset_code, i.category, i.location].join(' ')
const memberKey = m => m.id
const memberCode = m => m.member_code
const memberText = m => [m.full_name, m.member_code, m.department].join(' ')

function CheckOutForm({ items, members, loading, onDone }) {
  const addToast = useAdminStore(s => s.addToast)
  const [item, setItem] = useState(null)
  const [borrower, setBorrower] = useState(null)
  const [expectedReturn, setExpectedReturn] = useState('')
  const [note, setNote] = useState('')
  const [scanning, setScanning] = useState(null)
  const [busy, setBusy] = useState(false)

  // Available items first so the suggestions lead with what can be lent.
  const sortedItems = useMemo(
    () => [...items].sort((a, b) => (a.status === 'available' ? 0 : 1) - (b.status === 'available' ? 0 : 1)),
    [items]
  )

  const onScanned = raw => {
    const code = normalizeCode(raw)
    if (scanning === 'item') {
      const match = items.find(i => i.asset_code?.toUpperCase() === code)
      if (!match) addToast(`No item with code ${code}.`, 'error')
      else if (match.status !== 'available') addToast(`${match.name} is not available (${match.status}).`, 'error')
      else setItem(match)
    } else {
      const match = members.find(m => m.member_code?.toUpperCase() === code)
      if (match) setBorrower(match)
      else addToast(`No member with code ${code}.`, 'error')
    }
    setScanning(null)
  }

  const submit = async e => {
    e.preventDefault()
    if (!item) { addToast('Pick the item being borrowed.', 'error'); return }
    setBusy(true)

    // Flip the status only while it is still available, so the same item
    // can't be lent twice from two screens.
    const { data: claimed, error: claimErr } = await supabase
      .from('inventory_items').update({ status: 'borrowed' })
      .eq('id', item.id).eq('status', 'available').select('id')
    if (claimErr || !claimed?.length) {
      addToast(claimErr ? 'The checkout was not recorded.' : `${item.name} is no longer available.`, 'error')
      setBusy(false)
      onDone()
      return
    }

    const member = borrower && !borrower.guest ? borrower : null
    const { error: insertErr } = await supabase.from('borrow_records').insert({
      item_id: item.id,
      member_id: member?.id ?? null,
      borrower_name: borrower?.full_name ?? null,
      expected_return_at: expectedReturn ? endOfDay(expectedReturn) : null,
      condition_note_out: note.trim() || null,
      status: 'active',
    })
    if (insertErr) {
      await supabase.from('inventory_items').update({ status: 'available' }).eq('id', item.id)
      addToast('The checkout was not recorded.', 'error')
      setBusy(false)
      return
    }

    logActivity('checked_out', 'inventory_items', item.id, { name: item.name, borrower: borrower?.full_name })
    addToast(`${item.name} checked out${borrower ? ` to ${borrower.full_name}` : ''}.`)
    setItem(null); setBorrower(null); setExpectedReturn(''); setNote('')
    setBusy(false)
    onDone()
  }

  return (
    <Panel className="p-5 sm:p-6">
      <form onSubmit={submit} className="space-y-4 max-w-lg">
        <SearchPicker
          label="Item"
          placeholder={loading ? 'Loading inventory…' : 'Search by name or asset code…'}
          options={sortedItems}
          value={item}
          onChange={setItem}
          getKey={itemKey}
          getCode={itemCode}
          getSearchText={itemText}
          renderOption={i => <ItemOption item={i} />}
          isDisabled={i => (i.status !== 'available' ? i.status : null)}
          onScan={() => setScanning('item')}
          emptyText="No item matches. Add it from Inventory first."
          autoFocus
        />
        <SearchPicker
          label="Borrower (optional)"
          placeholder="Search member by name or code…"
          options={members}
          value={borrower}
          onChange={setBorrower}
          getKey={memberKey}
          getCode={memberCode}
          getSearchText={memberText}
          renderOption={m => <MemberOption member={m} />}
          onScan={() => setScanning('member')}
          onFreeText={name => setBorrower({ id: `guest:${name}`, full_name: name, guest: true })}
          freeTextLabel={name => `Lend to “${name}” (not a member)`}
          emptyText="No member matches."
        />
        <TextField
          label="Expected return date"
          type="date"
          value={expectedReturn}
          min={new Date().toISOString().slice(0, 10)}
          onChange={e => setExpectedReturn(e.target.value)}
        />
        <TextArea label="Condition notes" value={note} onChange={e => setNote(e.target.value)} placeholder="Working, minor scuff on the case…" />
        <Button type="submit" variant="primary" icon={PackageMinus} busy={busy} busyLabel="Checking out…" disabled={!item}>Check out</Button>
      </form>

      <QrScanner
        open={!!scanning}
        onClose={() => setScanning(null)}
        title={scanning === 'item' ? 'Scan item label' : 'Scan member card'}
        onResult={onScanned}
      />
    </Panel>
  )
}

const loanKey = r => r.id
const loanCode = r => r.item?.asset_code
const loanText = r => [r.item?.name, r.item?.asset_code, r.member?.full_name, r.borrower_name, r.member?.member_code].join(' ')

function LoanOption({ loan }) {
  const who = loan.member?.full_name || loan.borrower_name
  return (
    <span className="flex items-center gap-3 min-w-0">
      <span className="min-w-0 flex-1 block">
        <span className="block text-sm font-semibold adm-truncate">{loan.item?.name}</span>
        <span className="adm-data block text-[11px] adm-truncate" style={{ color: 'var(--adm-silk-faint)' }}>
          {[
            loan.item?.asset_code,
            who ? `with ${who}` : null,
            loan.expected_return_at ? `due ${formatDate(loan.expected_return_at)}` : null,
          ].filter(Boolean).join(' · ')}
        </span>
      </span>
      {loan.computedStatus === 'overdue' && <StatusBadge status="overdue" />}
    </span>
  )
}

function ReturnForm({ loans, items, loading, onDone }) {
  const addToast = useAdminStore(s => s.addToast)
  const [loan, setLoan] = useState(null)
  const [note, setNote] = useState('')
  const [scanning, setScanning] = useState(false)
  const [busy, setBusy] = useState(false)

  // Items marked borrowed with no open record (a half-finished checkout) were
  // stuck forever before — offer them too so they can be released.
  const options = useMemo(() => {
    const open = new Set(loans.map(l => l.item_id))
    const orphans = items
      .filter(i => i.status === 'borrowed' && !open.has(i.id))
      .map(i => ({ id: `orphan:${i.id}`, orphan: true, item_id: i.id, item: i, status: 'active', computedStatus: 'active' }))
    return [...loans, ...orphans]
  }, [loans, items])

  const onScanned = raw => {
    const code = normalizeCode(raw)
    const match = options.find(l => l.item?.asset_code?.toUpperCase() === code)
    if (match) setLoan(match)
    else addToast(`Nothing checked out with code ${code}.`, 'error')
    setScanning(false)
  }

  const submit = async e => {
    e.preventDefault()
    if (!loan) { addToast('Pick the item being returned.', 'error'); return }
    setBusy(true)

    if (!loan.orphan) {
      const { error } = await supabase.from('borrow_records').update({
        status: 'returned', returned_at: new Date().toISOString(), condition_note_in: note.trim() || null,
      }).eq('id', loan.id)
      if (error) { addToast('The return was not recorded.', 'error'); setBusy(false); return }
    }
    const { error: itemErr } = await supabase.from('inventory_items').update({ status: 'available' }).eq('id', loan.item_id)
    if (itemErr) addToast('Return logged, but the item is still marked borrowed.', 'error')
    else addToast(`${loan.item.name} marked returned.`)

    logActivity('returned', 'inventory_items', loan.item_id, { name: loan.item.name })
    setLoan(null); setNote('')
    setBusy(false)
    onDone()
  }

  return (
    <Panel className="p-5 sm:p-6">
      <form onSubmit={submit} className="space-y-4 max-w-lg">
        <SearchPicker
          label="Item"
          placeholder={loading ? 'Loading loans…' : 'Search by item, code or borrower…'}
          options={options}
          value={loan}
          onChange={setLoan}
          getKey={loanKey}
          getCode={loanCode}
          getSearchText={loanText}
          renderOption={l => <LoanOption loan={l} />}
          onScan={() => setScanning(true)}
          emptyText={options.length ? 'No borrowed item matches.' : 'Nothing is checked out right now.'}
          limit={20}
          autoFocus
        />
        <TextArea label="Return condition notes" value={note} onChange={e => setNote(e.target.value)} placeholder="Returned in good condition…" />
        <Button type="submit" variant="primary" icon={PackageCheck} busy={busy} busyLabel="Returning…" disabled={!loan}>Mark returned</Button>
      </form>

      <QrScanner
        open={scanning}
        onClose={() => setScanning(false)}
        title="Scan item label"
        onResult={onScanned}
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
