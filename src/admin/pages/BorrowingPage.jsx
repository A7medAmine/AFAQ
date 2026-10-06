import { useCallback, useEffect, useMemo, useState } from 'react'
import { Minus, PackageCheck, PackageMinus, PackageX, Plus, ScrollText, Trash2 } from 'lucide-react'
import { logActivity, read, supabase } from '../lib/db'
import useAdminStore from '../store/adminStore'
import PageHeader, { FilterTabs } from '../components/ui/PageHeader'
import DataTable from '../components/ui/DataTable'
import EmptyState, { ErrorState } from '../components/ui/EmptyState'
import Panel from '../components/ui/Panel'
import Button, { IconButton } from '../components/ui/Button'
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

// One basket line per item. The item itself comes from the latest list, so
// counts stay right after a reload.
const defaultKind = item => (item.tracking_mode === 'consumable' ? 'issue' : 'loan')

const LINE_KINDS = [
  { value: 'loan', label: 'Lend' },
  { value: 'issue', label: 'Hand out' },
]

function CheckOutForm({ items, members, loading, onDone }) {
  const addToast = useAdminStore(s => s.addToast)
  const [lines, setLines] = useState([]) // { itemId, qty: string, kind }
  const [borrower, setBorrower] = useState(null)
  const [expectedReturn, setExpectedReturn] = useState('')
  const [note, setNote] = useState('')
  const [purpose, setPurpose] = useState('')
  const [shortId, setShortId] = useState(null) // line the database said ran out
  const [busy, setBusy] = useState(false)

  const byId = useMemo(() => new Map(items.map(i => [i.id, i])), [items])
  const basket = lines.map(l => {
    const item = byId.get(l.itemId)
    const max = item ? available(item) : 0
    const n = Number(l.qty)
    return { ...l, item, max, n, ok: !!item && Number.isInteger(n) && n >= 1 && n <= max }
  })
  const allOk = basket.length > 0 && basket.every(l => l.ok)
  const units = basket.reduce((s, l) => s + (l.ok ? l.n : 0), 0)
  const lending = basket.filter(l => l.kind === 'loan')
  const handing = basket.filter(l => l.kind === 'issue')
  const allKind = lending.length && !handing.length ? 'loan' : handing.length && !lending.length ? 'issue' : null

  // Available items first so the suggestions lead with what can go out.
  const sortedItems = useMemo(
    () => [...items].sort((a, b) => (a.status === 'available' ? 0 : 1) - (b.status === 'available' ? 0 : 1)),
    [items]
  )

  const setLine = (itemId, changes) => setLines(ls => ls.map(l => (l.itemId === itemId ? { ...l, ...changes } : l)))
  const removeLine = itemId => setLines(ls => ls.filter(l => l.itemId !== itemId))

  // A scan of something already in the basket adds one more of it.
  const add = item => {
    if (!item) return
    setShortId(null)
    const line = lines.find(l => l.itemId === item.id)
    if (!line) { setLines(ls => [...ls, { itemId: item.id, qty: '1', kind: defaultKind(item) }]); return }
    const next = (Number(line.qty) || 0) + 1
    if (next > available(item)) { addToast(`All ${available(item)} ${item.name} on the shelf are already in the basket.`, 'error'); return }
    setLine(item.id, { qty: String(next) })
  }

  const reset = () => {
    setLines([]); setBorrower(null); setExpectedReturn(''); setNote(''); setPurpose(''); setShortId(null)
  }

  const submit = async e => {
    e.preventDefault()
    if (!basket.length) { addToast('Scan or pick at least one item.', 'error'); return }
    const bad = basket.find(l => !l.ok)
    if (bad) { addToast(`${bad.item?.name || 'An item'}: between 1 and ${bad.max}.`, 'error'); return }
    setBusy(true)

    // One database step for the whole basket: every line goes out and is
    // recorded, or none does — so the same last unit can't go out twice and
    // a failure never leaves half a checkout behind.
    const member = borrower && !borrower.guest ? borrower : null
    const { error } = await supabase.rpc('inventory_checkout', {
      p_lines: basket.map(l => ({ item_id: l.itemId, quantity: l.n, kind: l.kind })),
      p_member: member?.id ?? null,
      p_borrower: borrower?.full_name ?? null,
      p_purpose: purpose.trim() || null,
      p_due: lending.length && expectedReturn ? endOfDay(expectedReturn) : null,
      p_note: note.trim() || null,
    })
    setBusy(false)
    if (error) {
      const short = /not_enough:(\d+)/.exec(error.message || '')
      if (short) {
        const item = byId.get(Number(short[1]))
        setShortId(Number(short[1]))
        addToast(`Not enough ${item?.name || 'of one item'} left — nothing was checked out.`, 'error')
        onDone()
      } else {
        addToast('The checkout was not recorded.', 'error')
      }
      return
    }

    for (const l of basket) {
      logActivity(l.kind === 'issue' ? 'issued' : 'checked_out', 'inventory_items', l.itemId, {
        name: l.item.name, quantity: l.n, borrower: borrower?.full_name, purpose: purpose.trim() || undefined,
      })
    }
    const parts = [
      lending.length ? `${lending.length} lent` : null,
      handing.length ? `${handing.length} handed out` : null,
    ].filter(Boolean).join(', ')
    const to = borrower ? ` to ${borrower.full_name}` : ''
    addToast(basket.length === 1
      ? `${units > 1 ? `${units} × ` : ''}${basket[0].item.name} ${basket[0].kind === 'issue' ? 'handed out' : 'checked out'}${to}.`
      : `${basket.length} items checked out (${parts})${to}.`)
    reset()
    onDone()
  }

  return (
    <form onSubmit={submit} className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-5 items-start">
      <Panel className="p-5 sm:p-6 space-y-4">
        <SearchPicker
          label="Scan or search items"
          placeholder={loading ? 'Loading inventory…' : 'Scan a label, or type a name or asset code…'}
          options={sortedItems}
          value={null}
          onChange={add}
          getKey={itemKey}
          getCode={itemCode}
          getSearchText={itemText}
          renderOption={i => <ItemOption item={i} />}
          isDisabled={i => (i.status !== 'available' ? UNAVAILABLE[i.status] || i.status : null)}
          onRejected={(i, reason) => addToast(`${i.name} can't go out — ${reason}.`, 'error')}
          emptyText="No item matches. Add it from Inventory first."
          autoFocus
        />

        {basket.length > 0 ? (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
              <span className="text-[12.5px]" style={{ color: 'var(--adm-silk-faint)' }}>
                {basket.length} {basket.length === 1 ? 'item' : 'items'} · {units} {units === 1 ? 'unit' : 'units'}
              </span>
              {basket.length > 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-[12px]" style={{ color: 'var(--adm-silk-faint)' }}>All:</span>
                  <FilterTabs
                    options={LINE_KINDS}
                    value={allKind}
                    onChange={k => setLines(ls => ls.map(l => ({ ...l, kind: k })))}
                    label="Set every item"
                  />
                </div>
              )}
            </div>
            <ul className="rounded-xl" style={{ border: '1px solid var(--adm-trace)' }}>
              {basket.map((l, i) => (
                <BasketLine
                  key={l.itemId}
                  line={l}
                  first={i === 0}
                  short={shortId === l.itemId}
                  onQty={qty => { setShortId(null); setLine(l.itemId, { qty }) }}
                  onKind={kind => setLine(l.itemId, { kind })}
                  onRemove={() => removeLine(l.itemId)}
                />
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-[13px] py-6 px-4 text-center rounded-xl" style={{ color: 'var(--adm-silk-faint)', border: '1px dashed var(--adm-trace)' }}>
            The basket is empty. Scan each item's label — scan it again to add one more.
          </p>
        )}
      </Panel>

      <Panel className="p-5 sm:p-6 space-y-4">
        <SearchPicker
          label="Borrower (optional)"
          placeholder="Scan a card, or search by name or code…"
          options={members}
          value={borrower}
          onChange={setBorrower}
          getKey={memberKey}
          getCode={memberCode}
          getSearchText={memberText}
          renderOption={m => <MemberOption member={m} />}
          onFreeText={name => setBorrower({ id: `guest:${name}`, full_name: name, guest: true })}
          freeTextLabel={name => `Give to “${name}” (not a member)`}
          emptyText="No member matches."
        />
        <TextField
          label="For (optional)"
          value={purpose}
          onChange={e => setPurpose(e.target.value)}
          placeholder="Line-follower robot, Arduino workshop…"
          hint="The project or event. Applies to every item."
        />
        {lending.length > 0 && (
          <TextField
            label="Expected return date"
            type="date"
            value={expectedReturn}
            min={new Date().toISOString().slice(0, 10)}
            onChange={e => setExpectedReturn(e.target.value)}
            hint={handing.length ? 'For the lent items only.' : undefined}
          />
        )}
        <TextArea label="Notes" value={note} onChange={e => setNote(e.target.value)}
          placeholder={lending.length ? 'Working, minor scuff on the case…' : 'Optional'} />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="primary" icon={PackageMinus} busy={busy} busyLabel="Checking out…" disabled={!allOk}>
            {checkoutLabel(lending.length, handing.length)}
          </Button>
          {basket.length > 0 && <Button variant="ghost" onClick={reset} disabled={busy}>Clear</Button>}
        </div>
      </Panel>
    </form>
  )
}

function checkoutLabel(lent, handed) {
  if (!lent && !handed) return 'Check out'
  if (!handed) return lent > 1 ? `Lend ${lent} items` : 'Lend'
  if (!lent) return handed > 1 ? `Hand out ${handed} items` : 'Hand out'
  return `Check out ${lent + handed} items`
}

function BasketLine({ line, first, short, onQty, onKind, onRemove }) {
  const { item, max, n, ok } = line
  if (!item) return null
  const step = d => onQty(String(Math.min(max, Math.max(1, (Number.isInteger(n) ? n : 1) + d))))
  return (
    <li className="flex flex-wrap items-center gap-3 p-3" style={first ? undefined : { borderTop: '1px solid var(--adm-trace)' }}>
      <span className="min-w-0 flex-1 basis-48 block">
        <span className="block text-sm font-semibold adm-truncate">{item.name}</span>
        <span className="adm-data block text-[11px] adm-truncate" style={{ color: short || !ok ? 'var(--adm-fault)' : 'var(--adm-silk-faint)' }}>
          {short
            ? `Only ${max} left now. Lower the count or remove it.`
            : !ok
              ? `Between 1 and ${max}`
              : [item.asset_code, `${max} on the shelf`, item.location].filter(Boolean).join(' · ')}
        </span>
      </span>
      <FilterTabs options={LINE_KINDS} value={line.kind} onChange={onKind} label={`${item.name}: lend or hand out`} />
      <div className="flex items-center gap-1">
        <IconButton icon={Minus} label="One less" size={14} tabIndex={-1} onClick={() => step(-1)} disabled={n <= 1} />
        <input
          className="adm-input adm-data text-center"
          style={{ width: 60 }}
          type="number"
          inputMode="numeric"
          aria-label={`How many ${item.name}`}
          aria-invalid={!ok || undefined}
          min={1}
          max={max}
          step={1}
          value={line.qty}
          onChange={e => onQty(e.target.value)}
          onFocus={e => e.target.select()}
        />
        <IconButton icon={Plus} label="One more" size={14} tabIndex={-1} onClick={() => step(1)} disabled={n >= max} />
      </div>
      <IconButton icon={Trash2} label={`Remove ${item.name}`} danger size={15} onClick={onRemove} />
    </li>
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
