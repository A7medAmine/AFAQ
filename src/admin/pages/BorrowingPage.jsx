import { useCallback, useEffect, useMemo, useState } from 'react'
import { PackageCheck, PackageMinus, PackageX, ScrollText } from 'lucide-react'
import { logActivity, read, supabase } from '../lib/db'
import useAdminStore from '../store/adminStore'
import PageHeader, { FilterTabs } from '../components/ui/PageHeader'
import DataTable from '../components/ui/DataTable'
import EmptyState, { ErrorState } from '../components/ui/EmptyState'
import Panel from '../components/ui/Panel'
import Button from '../components/ui/Button'
import ExportMenu from '../components/ui/ExportMenu'
import { StatusBadge } from '../components/ui/Badge'
import { CheckField, TextArea, TextField } from '../components/ui/Field'
import SearchPicker from '../components/ui/SearchPicker'
import { formatDate, formatDateTime } from '../lib/format'

const TABS = [
  { value: 'checkout', label: 'Check out' },
  { value: 'return', label: 'Return' },
  { value: 'history', label: 'History' },
]

// A loan comes back; an issue is handed out for good (a part used in a build).
const KINDS = [
  { value: 'loan', label: 'Lend — comes back' },
  { value: 'issue', label: 'Hand out — used up' },
]

const kindLabel = record => (record.kind === 'issue' ? 'Handed out' : 'Loan')

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
          .select('*, item:inventory_items(id, name, asset_code, category, location, status, quantity, on_loan, tracking_mode), member:members(full_name, member_code)')
          .order('checked_out_at', { ascending: false })
      ),
      read(
        supabase.from('inventory_items')
          .select('id, name, asset_code, category, location, status, quantity, on_loan, tracking_mode')
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
        description="Lend tools that come back, or hand out parts that get used in a build. Type the item or member name, or scan the label or card with a barcode scanner."
        actions={tab === 'history' && (
          <ExportMenu
            filename={`borrowing-history-${new Date().toISOString().slice(0, 10)}`}
            title="Borrowing history"
            subtitle={formatDateTime(new Date())}
            headers={['Item', 'Asset code', 'Borrower', 'Checked out', 'Due', 'Returned', 'Status', 'Quantity', 'Type', 'For', 'Used up']}
            rows={withOverdue.map(r => [
              r.item?.name, r.item?.asset_code, r.member?.full_name || r.borrower_name,
              formatDateTime(r.checked_out_at), r.expected_return_at ? formatDate(r.expected_return_at) : '',
              r.returned_at ? formatDateTime(r.returned_at) : '', r.computedStatus, r.quantity ?? 1,
              kindLabel(r), r.purpose || '', r.consumed_quantity || 0,
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
            {activeLoans.length} on loan{overdueCount > 0 ? `, ${overdueCount} overdue` : ''}
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

/** Units on the shelf right now — the rest are out on loan. */
const available = item => (item.quantity ?? 1) - (item.on_loan || 0)

const UNAVAILABLE = { borrowed: 'all out', out_of_stock: 'out of stock', repair: 'in repair', retired: 'retired' }

function ItemOption({ item }) {
  const total = item.quantity ?? 1
  return (
    <span className="min-w-0 block">
      <span className="block text-sm font-semibold adm-truncate">{item.name}</span>
      <span className="adm-data block text-[11px] adm-truncate" style={{ color: 'var(--adm-silk-faint)' }}>
        {[
          item.asset_code,
          total > 1 ? `${available(item)} of ${total} available` : null,
          item.category,
          item.location,
        ].filter(Boolean).join(' · ')}
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
  const [count, setCount] = useState('1')
  const [kind, setKind] = useState('loan')
  const [purpose, setPurpose] = useState('')
  const [busy, setBusy] = useState(false)

  const max = item ? available(item) : 1
  const n = Number(count)
  const countOk = Number.isInteger(n) && n >= 1 && n <= max
  const issue = kind === 'issue'
  // The item says whether it usually comes back; the switch can still override it.
  const pick = i => { setItem(i); setCount('1'); if (i) setKind(i.tracking_mode === 'consumable' ? 'issue' : 'loan') }

  // Available items first so the suggestions lead with what can be lent.
  const sortedItems = useMemo(
    () => [...items].sort((a, b) => (a.status === 'available' ? 0 : 1) - (b.status === 'available' ? 0 : 1)),
    [items]
  )

  const submit = async e => {
    e.preventDefault()
    if (!item) { addToast('Pick the item being borrowed.', 'error'); return }
    if (!countOk) { addToast(`${issue ? 'Hand out' : 'Lend'} between 1 and ${max}.`, 'error'); return }
    setBusy(true)

    // Take the units in one database step that checks enough are left, so
    // the same last unit can't go out twice from two screens. A loan counts
    // them as out; an issue takes them off the count for good.
    const { data: claimed, error: claimErr } = await supabase.rpc(issue ? 'inventory_issue' : 'inventory_lend', { p_item: item.id, p_qty: n })
    if (claimErr || !claimed) {
      addToast(claimErr ? 'The checkout was not recorded.' : `Not enough ${item.name} left to ${issue ? 'hand out' : 'lend'} ${n}.`, 'error')
      setBusy(false)
      onDone()
      return
    }

    const member = borrower && !borrower.guest ? borrower : null
    const { error: insertErr } = await supabase.from('borrow_records').insert({
      item_id: item.id,
      kind,
      quantity: n,
      consumed_quantity: issue ? n : 0,
      member_id: member?.id ?? null,
      borrower_name: borrower?.full_name ?? null,
      purpose: purpose.trim() || null,
      expected_return_at: !issue && expectedReturn ? endOfDay(expectedReturn) : null,
      condition_note_out: note.trim() || null,
      status: issue ? 'consumed' : 'active',
    })
    if (insertErr) {
      await (issue
        ? supabase.rpc('inventory_restock', { p_item: item.id, p_qty: n })
        : supabase.rpc('inventory_release', { p_item: item.id, p_qty: n }))
      addToast('The checkout was not recorded.', 'error')
      setBusy(false)
      return
    }

    logActivity(issue ? 'issued' : 'checked_out', 'inventory_items', item.id, {
      name: item.name, quantity: n, borrower: borrower?.full_name, purpose: purpose.trim() || undefined,
    })
    addToast(`${n > 1 ? `${n} × ` : ''}${item.name} ${issue ? 'handed out' : 'checked out'}${borrower ? ` to ${borrower.full_name}` : ''}.`)
    setItem(null); setCount('1'); setBorrower(null); setExpectedReturn(''); setNote(''); setPurpose('')
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
          onChange={pick}
          getKey={itemKey}
          getCode={itemCode}
          getSearchText={itemText}
          renderOption={i => <ItemOption item={i} />}
          isDisabled={i => (i.status !== 'available' ? UNAVAILABLE[i.status] || i.status : null)}
          emptyText="No item matches. Add it from Inventory first."
          autoFocus
        />
        {item && (
          <div>
            <FilterTabs options={KINDS} value={kind} onChange={setKind} label="Comes back or used up" />
            <p className="text-[12px] mt-1.5" style={{ color: 'var(--adm-silk-faint)' }}>
              {issue
                ? 'Leaves the stock for good — for parts that go into a build.'
                : 'Counted as out until it\'s returned.'}
            </p>
          </div>
        )}
        {item && max > 1 && (
          <TextField
            label="How many"
            type="number"
            inputMode="numeric"
            min={1}
            max={max}
            step={1}
            value={count}
            error={count !== '' && !countOk ? `Between 1 and ${max} — that's how many are on the shelf.` : undefined}
            hint={`${max} of ${item.quantity ?? 1} available`}
            onChange={e => setCount(e.target.value)}
          />
        )}
        <SearchPicker
          label={issue ? 'Given to (optional)' : 'Borrower (optional)'}
          placeholder="Search member by name or code…"
          options={members}
          value={borrower}
          onChange={setBorrower}
          getKey={memberKey}
          getCode={memberCode}
          getSearchText={memberText}
          renderOption={m => <MemberOption member={m} />}
          onFreeText={name => setBorrower({ id: `guest:${name}`, full_name: name, guest: true })}
          freeTextLabel={name => `${issue ? 'Give' : 'Lend'} to “${name}” (not a member)`}
          emptyText="No member matches."
        />
        <TextField
          label="For (optional)"
          value={purpose}
          onChange={e => setPurpose(e.target.value)}
          placeholder="Line-follower robot, Arduino workshop…"
          hint={issue ? 'The project or event it goes into.' : undefined}
        />
        {!issue && (
          <TextField
            label="Expected return date"
            type="date"
            value={expectedReturn}
            min={new Date().toISOString().slice(0, 10)}
            onChange={e => setExpectedReturn(e.target.value)}
          />
        )}
        <TextArea label={issue ? 'Notes' : 'Condition notes'} value={note} onChange={e => setNote(e.target.value)}
          placeholder={issue ? 'Optional' : 'Working, minor scuff on the case…'} />
        <Button type="submit" variant="primary" icon={PackageMinus} busy={busy} busyLabel={issue ? 'Handing out…' : 'Checking out…'} disabled={!item || !countOk}>
          {issue ? 'Hand out' : 'Check out'}{item && n > 1 && countOk ? ` ${n}` : ''}
        </Button>
      </form>
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
        <span className="block text-sm font-semibold adm-truncate">
          {(loan.quantity ?? 1) > 1 ? `${loan.quantity} × ` : ''}{loan.item?.name}
        </span>
        <span className="adm-data block text-[11px] adm-truncate" style={{ color: 'var(--adm-silk-faint)' }}>
          {[
            loan.item?.asset_code,
            loan.orphan ? 'no open loan record' : null,
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
  const [back, setBack] = useState('')
  const [kept, setKept] = useState(false)
  const [busy, setBusy] = useState(false)

  // Some or all of a loan can be used up instead of coming back: 10 servos
  // out, 6 back, 4 went into the robot.
  const total = loan?.quantity ?? 1
  const returned = total > 1 ? Number(back) : kept ? 0 : 1
  const backOk = Number.isInteger(returned) && returned >= 0 && returned <= total
  const used = backOk ? total - returned : 0
  const pick = l => { setLoan(l); setBack(String(l?.quantity ?? 1)); setKept(false) }

  // Units counted as out with no open record (a half-finished checkout) were
  // stuck forever before — offer them too so they can be released.
  const options = useMemo(() => {
    const open = new Map()
    for (const l of loans) open.set(l.item_id, (open.get(l.item_id) || 0) + (l.quantity ?? 1))
    const orphans = items
      .map(i => ({ i, stray: (i.on_loan || 0) - (open.get(i.id) || 0) }))
      .filter(({ stray }) => stray > 0)
      .map(({ i, stray }) => ({ id: `orphan:${i.id}`, orphan: true, item_id: i.id, item: i, quantity: stray, status: 'active', computedStatus: 'active' }))
    return [...loans, ...orphans]
  }, [loans, items])

  const submit = async e => {
    e.preventDefault()
    if (!loan) { addToast('Pick the item being returned.', 'error'); return }
    if (!backOk) { addToast(`Between 0 and ${total} came back.`, 'error'); return }
    setBusy(true)

    if (!loan.orphan) {
      const { error } = await supabase.from('borrow_records').update({
        status: used === 0 ? 'returned' : returned === 0 ? 'consumed' : 'partially_consumed',
        consumed_quantity: used,
        returned_at: new Date().toISOString(),
        condition_note_in: note.trim() || null,
      }).eq('id', loan.id)
      if (error) { addToast('The return was not recorded.', 'error'); setBusy(false); return }
    }
    const { error: itemErr } = await supabase.rpc('inventory_settle', { p_item: loan.item_id, p_returned: returned, p_used: used })
    const name = loan.item.name
    if (itemErr) addToast('Return logged, but the item still counts it as out.', 'error')
    else if (used === 0) addToast(`${total > 1 ? `${total} × ` : ''}${name} marked returned.`)
    else if (returned === 0) addToast(`${total > 1 ? `${total} × ` : ''}${name} marked used up and taken off the stock.`)
    else addToast(`${name}: ${returned} back on the shelf, ${used} used up.`)

    logActivity(used ? 'settled' : 'returned', 'inventory_items', loan.item_id, { name, quantity: total, returned, used })
    setLoan(null); setNote(''); setBack(''); setKept(false)
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
          onChange={pick}
          getKey={loanKey}
          getCode={loanCode}
          getSearchText={loanText}
          renderOption={l => <LoanOption loan={l} />}
          emptyText={options.length ? 'No borrowed item matches.' : 'Nothing is checked out right now.'}
          limit={20}
          autoFocus
        />
        {loan && total > 1 && (
          <TextField
            label="How many came back"
            type="number"
            inputMode="numeric"
            min={0}
            max={total}
            step={1}
            value={back}
            error={back !== '' && !backOk ? `Between 0 and ${total}.` : undefined}
            hint={backOk && used > 0 ? `The other ${used} were used up and leave the stock.` : `All ${total} back on the shelf.`}
            onChange={e => setBack(e.target.value)}
          />
        )}
        {loan && total === 1 && (
          <CheckField
            label="Not coming back"
            description="Used in a project — it leaves the stock."
            checked={kept}
            onChange={setKept}
          />
        )}
        <TextArea label="Return condition notes" value={note} onChange={e => setNote(e.target.value)} placeholder="Returned in good condition…" />
        <Button type="submit" variant="primary" icon={used > 0 ? PackageX : PackageCheck} busy={busy} busyLabel="Saving…" disabled={!loan || !backOk}>
          {used === 0 ? 'Mark returned' : returned === 0 ? 'Mark used up' : `Return ${returned}, ${used} used up`}
        </Button>
      </form>
    </Panel>
  )
}

const HISTORY_KINDS = [
  { value: 'all', label: 'All' },
  { value: 'loan', label: 'Loans' },
  { value: 'issue', label: 'Handed out' },
]

function HistoryTable({ rows, loading }) {
  const [kind, setKind] = useState('all')
  const shown = useMemo(() => (kind === 'all' ? rows : rows.filter(r => (r.kind || 'loan') === kind)), [rows, kind])

  const columns = useMemo(() => [
    { header: 'Item', accessorKey: 'item.name', cell: ({ row }) => (
      <span className="min-w-0 block">
        <span className="block text-sm font-semibold adm-truncate" style={{ maxWidth: 200 }}>
          {(row.original.quantity ?? 1) > 1 ? `${row.original.quantity} × ` : ''}{row.original.item?.name || '—'}
        </span>
        <span className="adm-data block text-[11px]" style={{ color: 'var(--adm-silk-faint)' }}>
          {[
            row.original.item?.asset_code,
            row.original.kind !== 'issue' && row.original.consumed_quantity > 0 ? `${row.original.consumed_quantity} used up` : null,
          ].filter(Boolean).join(' · ')}
        </span>
      </span>
    )},
    { header: 'Type', id: 'kind', accessorFn: kindLabel, cell: ({ row }) => (
      <span className="text-[13px]" style={{ color: 'var(--adm-silk-dim)' }}>{kindLabel(row.original)}</span>
    )},
    { header: 'Borrower', accessorKey: 'borrower_name', cell: ({ row }) => (
      <span className="text-[13px]" style={{ color: 'var(--adm-silk-dim)' }}>
        {row.original.member?.full_name || row.original.borrower_name || '—'}
      </span>
    )},
    { header: 'For', accessorKey: 'purpose', cell: ({ row }) => (
      <span className="text-[13px] block adm-truncate" style={{ color: 'var(--adm-silk-dim)', maxWidth: 180 }}>{row.original.purpose || '—'}</span>
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
      data={shown}
      loading={loading}
      getRowId={row => String(row.id)}
      toolbar={<FilterTabs options={HISTORY_KINDS} value={kind} onChange={setKind} label="Type filter" />}
      searchPlaceholder="Search by item, borrower or project…"
      emptyState={<EmptyState icon={ScrollText} title="No borrow history yet" description="Check out an item to start the log." />}
    />
  )
}
