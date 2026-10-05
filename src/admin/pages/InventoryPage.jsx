import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Boxes, CheckCircle2, Eye, FileSpreadsheet, IdCard, Library, Loader2, Minus, PackagePlus, Pencil, Plus, Printer, Search, Trash2, Upload } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { api, logActivity, read, run, supabase, uploadFile } from '../lib/db'
import useAdminStore from '../store/adminStore'
import useQueryParam from '../hooks/useQueryParam'
import { formatDate, formatDateTime } from '../lib/format'
import PageHeader, { FilterTabs } from '../components/ui/PageHeader'
import DataTable from '../components/ui/DataTable'
import Drawer, { DetailRow } from '../components/ui/Drawer'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import EmptyState, { ErrorState } from '../components/ui/EmptyState'
import Button, { IconButton } from '../components/ui/Button'
import ExportMenu from '../components/ui/ExportMenu'
import { StatusBadge } from '../components/ui/Badge'
import Panel from '../components/ui/Panel'
import { Field, SelectField, TextArea, TextField } from '../components/ui/Field'
import PartNameField from '../components/inventory/PartNameField'
import ImportItemsModal from '../components/inventory/ImportItemsModal'
import { CATEGORIES, MAX_QUANTITY, TRACKING_MODES, defaultTracking, isLowStock } from '../lib/inventoryImport'
import { createShelf, loadShelves } from '../lib/shelves'
import { labelItem } from '../lib/assetCodes'
import {
  InlineEdit, NameCell, QuantityCell, CategoryCell, LocationCell, ConditionCell, StatusCell, CONDITIONS, STATUSES,
  minQuantityFor, statusFor,
} from '../components/inventory/InlineCells'

/** Rows from before the quantity column count as one. */
const qty = item => item.quantity ?? 1

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'available', label: 'Available' },
  { value: 'borrowed', label: 'Borrowed' },
  { value: 'low', label: 'Low stock' },
  { value: 'out_of_stock', label: 'Out of stock' },
  { value: 'repair', label: 'In repair' },
  { value: 'retired', label: 'Retired' },
]

/** "Low stock" is worked out from the counts, not stored as a status. */
const inFilter = (row, filter) => (filter === 'all' ? true : filter === 'low' ? isLowStock(row) : row.status === filter)

const trackingLabel = mode => TRACKING_MODES.find(m => m.value === mode)?.label || TRACKING_MODES[0].label

export default function InventoryPage() {
  const navigate = useNavigate()
  const addToast = useAdminStore(s => s.addToast)

  const [rows, setRows] = useState([])
  const [state, setState] = useState({ loading: true, error: null })
  const [status, setStatus] = useQueryParam('status', 'all')
  const [search] = useQueryParam('q')
  const [newFlag, setNewFlag] = useQueryParam('new')

  const [detail, setDetail] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [remove, setRemove] = useState(null)
  const [editing, setEditing] = useState(null)
  const [destroying, setDestroying] = useState(null)
  const [bulkDeleting, setBulkDeleting] = useState(null) // { items, clear }
  const [shelves, setShelves] = useState(null) // null until loaded, or if the shelves table isn't there yet

  // If the shelves migration hasn't run yet, location stays a free-text box.
  const loadShelfList = useCallback(async () => {
    const { ok, data } = await loadShelves()
    setShelves(ok ? data || [] : null)
  }, [])
  useEffect(() => { loadShelfList() }, [loadShelfList])
  const addShelf = shelf => setShelves(list => [...(list || []), shelf].sort((a, b) => a.name.localeCompare(b.name)))

  const load = useCallback(async () => {
    setState(s => ({ ...s, error: null }))
    const { ok, data, message } = await read(
      supabase.from('inventory_items').select('*').order('created_at', { ascending: false })
    )
    if (!ok) { setState({ loading: false, error: message }); return }
    setRows(data || [])
    setState({ loading: false, error: null })
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (newFlag) { setAddOpen(true); setNewFlag('') }
  }, [newFlag, setNewFlag])

  const filtered = useMemo(
    () => (status === 'all' ? rows : rows.filter(r => inFilter(r, status))),
    [rows, status]
  )

  const filterOptions = FILTERS.map(f => ({
    ...f,
    count: f.value === 'all' ? rows.length : rows.filter(r => inFilter(r, f.value)).length,
  }))

  const retire = async item => {
    const { ok } = await run(
      supabase.from('inventory_items').update({ status: 'retired' }).eq('id', item.id),
      { success: `${item.name} retired.`, failure: 'The item was not updated.' }
    )
    if (ok) { logActivity('retired', 'inventory_items', item.id, { name: item.name }); await load(); setRemove(null); setDetail(null) }
  }

  const destroy = async item => {
    const { ok } = await run(
      supabase.from('inventory_items').delete().eq('id', item.id),
      { success: `${item.name} deleted.`, failure: 'The item was not deleted.' }
    )
    if (ok) { logActivity('deleted', 'inventory_items', item.id, { name: item.name, asset_code: item.asset_code }); setDestroying(null); setDetail(null); await load() }
  }

  /**
   * Saves one field change from the table. The row updates right away and
   * rolls back if the database refuses.
   */
  const patch = useCallback(async (item, changes) => {
    const before = rows.find(r => r.id === item.id) || item
    const apply = values => {
      setRows(rs => rs.map(r => r.id === item.id ? { ...r, ...values } : r))
      setDetail(d => d && d.id === item.id ? { ...d, ...values } : d)
    }
    apply(changes)
    const { ok } = await run(
      supabase.from('inventory_items').update({ ...changes, updated_at: new Date().toISOString() }).eq('id', item.id),
      { failure: `${item.name} was not saved.` }
    )
    if (!ok) { apply(Object.fromEntries(Object.keys(changes).map(k => [k, before[k]]))); return false }
    logActivity('updated', 'inventory_items', item.id, { name: changes.name || item.name, ...changes })
    return true
  }, [rows])

  /** One change to every selected item: shelf, category, condition or status. */
  const bulkUpdate = async (items, field, value, done) => {
    const label = { location: 'shelf', category: 'category', condition: 'condition', status: 'status' }[field]
    // The counts decide borrowed and out-of-stock, so those keep theirs.
    const target = (field === 'status' ? items.filter(i => i.status !== 'borrowed' && i.status !== 'out_of_stock') : items).map(i => i.id)
    if (!target.length) { addToast('All of those are out on loan or out of stock, so their status follows the count.', 'error'); return }
    const { ok } = await run(
      supabase.from('inventory_items').update({ [field]: value || null, updated_at: new Date().toISOString() }).in('id', target),
      { success: `Changed the ${label} of ${target.length} item${target.length === 1 ? '' : 's'}.`, failure: 'Nothing was changed.' }
    )
    if (!ok) return
    logActivity('updated', 'inventory_items', null, { name: `Bulk ${label} change`, [field]: value || null, count: target.length })
    const ids = new Set(target)
    setRows(rs => rs.map(r => ids.has(r.id) ? { ...r, [field]: value || null } : r))
    done()
  }

  const bulkDestroy = async ({ items, clear }) => {
    const { ok } = await run(
      supabase.from('inventory_items').delete().in('id', items.map(i => i.id)),
      { success: `Deleted ${items.length} item${items.length === 1 ? '' : 's'}.`, failure: 'Nothing was deleted.' }
    )
    if (!ok) return
    logActivity('deleted', 'inventory_items', null, { name: 'Bulk delete', count: items.length, asset_codes: items.map(i => i.asset_code) })
    clear()
    setBulkDeleting(null)
    await load()
  }

  const printLabels = items => {
    const ids = items.filter(i => i.asset_code).map(i => i.id)
    if (ids.length) navigate(`/admin/inventory/labels?ids=${ids.join(',')}`)
  }

  const exportHeaders = ['Asset code', 'Name', 'Category', 'Serial', 'Condition', 'Location', 'Status', 'Added', 'Quantity', 'On loan', 'Type', 'Min stock']
  const exportRows = filtered.map(r => [
    r.asset_code, r.name, r.category, r.serial, r.condition, r.location, r.status, formatDate(r.created_at), qty(r), r.on_loan || 0,
    trackingLabel(r.tracking_mode), r.min_stock ?? '',
  ])

  // Cells get the save function from context, so these columns never change.
  const columns = useMemo(() => [
    { header: 'Item', accessorKey: 'name', cell: ({ row }) => <NameCell item={row.original} /> },
    { header: 'Qty', id: 'quantity', accessorFn: r => qty(r), cell: ({ row }) => <QuantityCell item={row.original} /> },
    { header: 'Category', accessorKey: 'category', cell: ({ row }) => <CategoryCell item={row.original} /> },
    { header: 'Location', accessorKey: 'location', cell: ({ row }) => <LocationCell item={row.original} /> },
    { header: 'Condition', accessorKey: 'condition', cell: ({ row }) => <ConditionCell item={row.original} /> },
    { header: 'Status', accessorKey: 'status', cell: ({ row }) => <StatusCell item={row.original} /> },
    {
      header: 'Added',
      accessorKey: 'created_at',
      cell: ({ row }) => <span className="adm-data text-[12px]">{formatDate(row.original.created_at)}</span>,
    },
    { id: 'actions', header: '', enableSorting: false, cell: ({ row }) => <RowActions item={row.original} /> },
  ], [])

  const inline = useMemo(
    () => ({ patch, shelves, open: setDetail, edit: setEditing, destroy: setDestroying }),
    [patch, shelves]
  )

  return (
    <div>
      <PageHeader
        eyebrow="Operate"
        title="Inventory"
        description="Edit right in the table: click a name to rename it, use − / + for the count, and the dropdowns for the rest. Changes save as you go."
        actions={
          <>
            <ExportMenu
              filename={`inventory-${status}-${new Date().toISOString().slice(0, 10)}`}
              title="Inventory"
              subtitle={`${FILTERS.find(f => f.value === status)?.label || 'All'} · ${formatDateTime(new Date())}`}
              headers={exportHeaders}
              rows={exportRows}
              statusColumnIndex={6}
              enumColumns={[2, 4, 6]}
              disabled={!filtered.length}
            />
            <Button icon={Printer} disabled={!filtered.length} onClick={() => printLabels(filtered)}>
              Print {filtered.length === rows.length ? 'all' : filtered.length} labels
            </Button>
            <Link to="/admin/inventory/shelves" className="adm-btn"><Library size={15} /> Shelves</Link>
            <Button icon={FileSpreadsheet} onClick={() => setImportOpen(true)}>Import</Button>
            <Button variant="primary" icon={PackagePlus} onClick={() => setAddOpen(true)}>Add item</Button>
          </>
        }
      />

      {state.error ? (
        <Panel><ErrorState message={state.error} onRetry={load} /></Panel>
      ) : (
        <InlineEdit.Provider value={inline}>
        <DataTable
          columns={columns}
          data={filtered}
          loading={state.loading}
          initialSearch={search}
          getRowId={row => String(row.id)}
          onRowClick={setDetail}
          enableSelection
          bulkActions={(selected, clear) => (
            <>
              {shelves && (
                <BulkSelect label="Move to shelf…" onPick={v => bulkUpdate(selected, 'location', v, clear)}>
                  <option value={NO_VALUE}>No shelf</option>
                  {shelves.map(sh => <option key={sh.id} value={sh.name}>{sh.name}</option>)}
                </BulkSelect>
              )}
              <BulkSelect label="Category…" onPick={v => bulkUpdate(selected, 'category', v, clear)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </BulkSelect>
              <BulkSelect label="Condition…" onPick={v => bulkUpdate(selected, 'condition', v, clear)}>
                {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </BulkSelect>
              <BulkSelect label="Status…" onPick={v => bulkUpdate(selected, 'status', v, clear)}>
                {STATUSES.map(st => <option key={st.value} value={st.value}>{st.label}</option>)}
              </BulkSelect>
              <Button size="sm" variant="danger" icon={Trash2} onClick={() => setBulkDeleting({ items: selected, clear })}>Delete</Button>
              <Button size="sm" variant="primary" icon={Printer} onClick={() => printLabels(selected)}>
                Print {selected.length} label{selected.length === 1 ? '' : 's'}
              </Button>
            </>
          )}
          searchPlaceholder="Search by name, asset code, location…"
          toolbar={<FilterTabs options={filterOptions} value={status} onChange={setStatus} label="Status filter" />}
          emptyState={
            rows.length === 0 ? (
              <EmptyState
                icon={Boxes}
                title="Nothing in inventory yet"
                description="Add electronics, tools or equipment. Each one gets a unique asset code and a printable QR label."
                action={
                  <span className="flex flex-wrap justify-center gap-2">
                    <Button icon={FileSpreadsheet} onClick={() => setImportOpen(true)}>Import from Excel</Button>
                    <Button variant="primary" icon={PackagePlus} onClick={() => setAddOpen(true)}>Add item</Button>
                  </span>
                }
              />
            ) : (
              <EmptyState compact icon={Boxes} title="Nothing in this view" description="Try another status." />
            )
          }
        />
        </InlineEdit.Provider>
      )}

      <Drawer
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.name || ''}
        subtitle={detail ? `Added ${formatDate(detail.created_at)}` : ''}
        badge={detail && <StatusBadge status={detail.status} />}
        footer={
          detail && (
            <>
              <Button className="mr-auto" variant="danger" icon={Trash2} onClick={() => setDestroying(detail)}>Delete</Button>
              {detail.status !== 'retired' && (
                <Button onClick={() => setRemove(detail)}>Retire</Button>
              )}
              <Button icon={Pencil} onClick={() => setEditing(detail)}>Edit</Button>
              <Link to={`/admin/inventory/${detail.id}/label`} className="adm-btn adm-btn-primary">
                <IdCard size={15} /> Print label
              </Link>
            </>
          )
        }
      >
        {detail && (
          <div className="space-y-5">
            <ItemPhoto item={detail} onUpdated={photo_url => {
              setDetail(d => d && { ...d, photo_url })
              setRows(rs => rs.map(r => r.id === detail.id ? { ...r, photo_url } : r))
            }} />
            <div className="grid grid-cols-2 gap-4">
              <DetailRow label="Asset code" mono>{detail.asset_code}</DetailRow>
              <DetailRow label="Quantity" mono>
                {qty(detail)}{detail.on_loan > 0 ? ` (${detail.on_loan} on loan, ${qty(detail) - detail.on_loan} here)` : ''}
              </DetailRow>
              <DetailRow label="Category">{detail.category || '—'}</DetailRow>
              <DetailRow label="Serial" mono>{detail.serial || '—'}</DetailRow>
              <DetailRow label="Condition">{detail.condition || '—'}</DetailRow>
              <DetailRow label="Location">{detail.location || '—'}</DetailRow>
              <DetailRow label="Value">{detail.value ? `${detail.value} DA` : '—'}</DetailRow>
              <DetailRow label="Type">{trackingLabel(detail.tracking_mode)}</DetailRow>
              <DetailRow label="Low stock at" mono>
                {detail.min_stock ?? '—'}{isLowStock(detail) ? ' (low now)' : ''}
              </DetailRow>
            </div>
            <DetailRow label="Notes">
              {detail.notes
                ? <p className="whitespace-pre-wrap leading-relaxed">{detail.notes}</p>
                : <span style={{ color: 'var(--adm-silk-faint)' }}>None.</span>}
            </DetailRow>
          </div>
        )}
      </Drawer>

      <AddItem open={addOpen} onClose={() => setAddOpen(false)} onAdded={load} existing={rows} shelves={shelves} onShelfCreated={addShelf} />
      <EditItem
        item={editing}
        shelves={shelves}
        onShelfCreated={addShelf}
        onClose={() => setEditing(null)}
        onSaved={updated => {
          setEditing(null)
          setDetail(d => d && d.id === updated.id ? { ...d, ...updated } : d)
          setRows(rs => rs.map(r => r.id === updated.id ? { ...r, ...updated } : r))
        }}
      />
      <ConfirmDialog
        open={!!destroying}
        onClose={() => setDestroying(null)}
        onConfirm={() => destroy(destroying)}
        title="Delete this item for good?"
        message={destroying
          ? `${destroying.name} (${destroying.asset_code || 'no code'}) and its borrowing history will be removed. This can't be undone — use Retire instead to keep the record.`
          : ''}
      />
      <ConfirmDialog
        open={!!bulkDeleting}
        onClose={() => setBulkDeleting(null)}
        onConfirm={() => bulkDestroy(bulkDeleting)}
        title={`Delete ${bulkDeleting?.items.length || 0} items for good?`}
        message={bulkDeleting
          ? `${bulkDeleting.items.slice(0, 5).map(i => i.name).join(', ')}${bulkDeleting.items.length > 5 ? ` and ${bulkDeleting.items.length - 5} more` : ''} will be removed with their borrowing history. This can't be undone.`
          : ''}
      />
      <ImportItemsModal open={importOpen} existing={rows} onClose={() => setImportOpen(false)} onImported={load} />

      <ConfirmDialog
        open={!!remove}
        onClose={() => setRemove(null)}
        onConfirm={() => retire(remove)}
        danger
        title="Retire this item?"
        confirmLabel="Retire"
        busyLabel="Retiring…"
        message={remove ? `${remove.name} will be marked retired and taken out of the available pool.` : ''}
      />
    </div>
  )
}

function RowActions({ item }) {
  const { open, edit, destroy } = useContext(InlineEdit)
  return (
    <span className="flex items-center justify-end gap-0.5" onClick={e => e.stopPropagation()}>
      <IconButton icon={Eye} label="Details" size={15} onClick={() => open(item)} />
      <IconButton icon={Pencil} label="Edit all fields" size={15} onClick={() => edit(item)} />
      <IconButton icon={Trash2} label="Delete" size={15} danger onClick={() => destroy(item)} />
    </span>
  )
}

const PLACEHOLDER = '__placeholder'
const NO_VALUE = '__none'

/** A dropdown in the selection bar that applies its choice to every selected row. */
function BulkSelect({ label, onPick, children }) {
  return (
    <select
      className="adm-input adm-cell-select"
      style={{ borderColor: 'var(--adm-signal-edge)', backgroundColor: 'var(--adm-panel)', color: 'var(--adm-silk)', maxWidth: 160 }}
      aria-label={label}
      value={PLACEHOLDER}
      onChange={e => onPick(e.target.value === NO_VALUE ? '' : e.target.value)}
    >
      <option value={PLACEHOLDER} disabled>{label}</option>
      {children}
    </select>
  )
}

function ItemPhoto({ item, onUpdated }) {
  const addToast = useAdminStore(s => s.addToast)
  const [busy, setBusy] = useState(false)

  const pick = async e => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const url = await uploadFile(file)
      const { ok } = await run(
        supabase.from('inventory_items').update({ photo_url: url }).eq('id', item.id),
        { failure: 'The photo did not save.' }
      )
      if (ok) onUpdated(url)
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div className="rounded-lg overflow-hidden shrink-0" style={{ width: 56, height: 56, background: 'var(--adm-panel-raise)' }}>
        {item.photo_url ? <img src={item.photo_url} alt="" className="w-full h-full object-cover" /> : null}
      </div>
      <label className="adm-btn adm-btn-sm" style={{ cursor: busy ? 'default' : 'pointer' }}>
        {busy ? <Loader2 size={14} className="adm-spin" /> : <Upload size={14} />}
        {item.photo_url ? 'Replace photo' : 'Add photo'}
        <input type="file" accept="image/*" className="sr-only" disabled={busy} onChange={pick} />
      </label>
    </div>
  )
}

const DIGIKEY_SCOPES = [
  { value: 'boards', label: 'Boards & kits' },
  { value: 'all', label: 'All parts' },
]

const sameText = (a, b) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase()

/**
 * Adds an item with how many the club has of it — one row, one asset code.
 * The same item already on the same shelf in the same condition just gets its
 * count raised. "Add & next" keeps the dialog open with category, condition
 * and location carried over, so a box of parts can be entered from the keyboard.
 */
function AddItem({ open, onClose, onAdded, existing, shelves, onShelfCreated }) {
  const navigate = useNavigate()
  const addToast = useAdminStore(s => s.addToast)
  const blank = { name: '', quantity: '1', category: 'Electronics', tracking_mode: 'returnable', min_stock: '', serial: '', condition: 'new', location: '', value: '', notes: '', photo_url: '' }
  const [form, setForm] = useState(blank)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(null) // null | 'next' | 'close'
  const [digikeyRequest, setDigikeyRequest] = useState(null)
  const [digikeyKey, setDigikeyKey] = useState(0)
  const [session, setSession] = useState([]) // what was added since the dialog opened
  const nameRef = useRef(null)

  useEffect(() => {
    if (open) { setForm(blank); setErrors({}); setDigikeyRequest(null); setSession([]) }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const quantity = Number(form.quantity)
  const stepQuantity = delta => {
    const n = Number.isInteger(quantity) ? quantity : 1
    set('quantity', String(Math.min(MAX_QUANTITY, Math.max(1, n + delta))))
  }

  const set = (key, value) => {
    setForm(f => ({ ...f, [key]: value }))
    setErrors(e => ({ ...e, [key]: undefined }))
  }

  // A serial number marks one specific unit, so that one always gets its own row.
  // Rows added in this dialog count too, before the list behind it reloads.
  const match = useMemo(() => {
    if (!form.name.trim() || form.serial.trim()) return null
    const fits = r => r.status !== 'retired' && sameText(r.name, form.name) && sameText(r.location, form.location) && r.condition === form.condition
    const fromSession = session.find(fits)
    const fromList = existing.find(fits)
    if (fromSession && fromList?.id === fromSession.id) return { ...fromList, quantity: fromSession.quantity }
    return fromSession || fromList || null
  }, [form.name, form.serial, form.location, form.condition, existing, session])

  /** A suggestion from PartNameField: our own stock or the offline parts catalog. */
  const applyPart = part => {
    setForm(f => ({
      ...f,
      name: part.name,
      category: CATEGORIES.includes(part.category) ? part.category : f.category,
      photo_url: part.image || f.photo_url,
      notes: f.notes.trim() ? f.notes : [part.description, part.specs].filter(Boolean).join('\n'),
    }))
    setErrors({})
  }

  const applyProduct = p => {
    setForm(f => ({
      ...f,
      name: p.description || p.partNumber || f.name,
      category: 'Electronics',
      photo_url: p.photoUrl || '',
      notes: [
        p.detailedDescription,
        p.manufacturer && `Manufacturer: ${p.manufacturer}`,
        p.partNumber && `Part number: ${p.partNumber}`,
        p.digikeyNumber && `DigiKey #: ${p.digikeyNumber}`,
        p.unitPrice != null && `DigiKey unit price: $${p.unitPrice}`,
        p.datasheetUrl && `Datasheet: ${p.datasheetUrl}`,
        p.productUrl && `Product page: ${p.productUrl}`,
      ].filter(Boolean).join('\n'),
    }))
    setErrors({})
  }

  const submit = async (then = 'next') => {
    if (saving) return
    const name = form.name.trim()
    const next = {}
    if (!name) next.name = 'Enter the item name.'
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) next.quantity = `A whole number from 1 to ${MAX_QUANTITY}.`
    const minStock = parseMinStock(form.min_stock)
    if (minStock === undefined) next.min_stock = 'A whole number, 0 or more — or leave it empty.'
    if (Object.keys(next).length) { setErrors(next); if (next.name) nameRef.current?.focus(); return }
    setSaving(then)

    let entry
    if (match) {
      const { ok, data: total } = await run(
        supabase.rpc('inventory_restock', { p_item: match.id, p_qty: quantity }),
        { failure: 'The count was not updated.' }
      )
      if (!ok) { setSaving(null); return }
      logActivity('restocked', 'inventory_items', match.id, { name: match.name, added: quantity, quantity: total })
      entry = { ...match, added: quantity, quantity: total, merged: true }
    } else {
      const { ok, data } = await run(
        supabase.from('inventory_items').insert({
          name,
          quantity,
          category: form.category,
          tracking_mode: form.tracking_mode,
          min_stock: minStock,
          serial: form.serial.trim() || null,
          condition: form.condition,
          location: form.location.trim() || null,
          value: form.value ? Number(form.value) : null,
          notes: form.notes.trim() || null,
          photo_url: form.photo_url || null,
          status: 'available',
        }).select().single(),
        { failure: 'The item was not added.' }
      )
      if (!ok) { setSaving(null); return }
      // QR labels are generated in-browser — same lib the backend uses.
      const asset_code = await labelItem(data.id)
      logActivity('created', 'inventory_items', data.id, quantity > 1 ? { name, quantity } : { name })
      entry = { ...data, asset_code, added: quantity }
    }

    setSaving(null)
    onAdded()
    if (then === 'close') { onClose(); return }

    addToast(entry.merged
      ? `${entry.name}: ${entry.added} more, ${entry.quantity} in total.`
      : `Added ${quantity > 1 ? `${quantity} × ` : ''}${name}.`, 'success')
    setSession(s => {
      const prev = s.find(r => r.id === entry.id)
      return [{ ...entry, added: entry.added + (prev?.added || 0) }, ...s.filter(r => r.id !== entry.id)]
    })
    // Keep where it's stored and what kind of thing it is; clear what's per-part.
    setForm(f => ({ ...blank, category: f.category, tracking_mode: f.tracking_mode, condition: f.condition, location: f.location }))
    setErrors({})
    setDigikeyRequest(null)
    setDigikeyKey(k => k + 1)
    requestAnimationFrame(() => nameRef.current?.focus())
  }

  // Enter in any single-line field adds and moves on to the next part; inputs
  // that use Enter themselves (name suggestions, DigiKey search) prevent it.
  const onKeyDown = e => {
    if (e.key !== 'Enter' || e.defaultPrevented || e.nativeEvent.isComposing) return
    if (e.target.tagName === 'TEXTAREA' && !(e.ctrlKey || e.metaKey)) return
    if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT' && e.target.tagName !== 'TEXTAREA') return
    e.preventDefault()
    submit(e.ctrlKey || e.metaKey ? 'close' : 'next')
  }

  const sessionIds = session.map(s => s.id)
  const sessionUnits = sessionIds.length

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add items"
      description="One entry per item with how many you have. Press Enter to add and start the next one."
      footer={
        <>
          {sessionUnits > 0 && (
            <Button className="mr-auto" icon={Printer} onClick={() => navigate(`/admin/inventory/labels?ids=${sessionIds.join(',')}`)}>
              Print {sessionUnits} label{sessionUnits === 1 ? '' : 's'}
            </Button>
          )}
          <Button onClick={onClose} data-dialog-dismiss="true">{sessionUnits ? 'Done' : 'Cancel'}</Button>
          <Button onClick={() => submit('close')} busy={saving === 'close'} busyLabel="Adding…" disabled={!!saving}>
            Add & close
          </Button>
          <Button variant="primary" icon={PackagePlus} onClick={() => submit('next')} busy={saving === 'next'} busyLabel="Adding…" disabled={!!saving}>
            {quantity > 1 && Number.isInteger(quantity) ? `Add ${quantity} & next` : 'Add & next'}
          </Button>
        </>
      }
    >
      <div className="space-y-4" onKeyDown={onKeyDown}>
        {session.length > 0 && <AddedSoFar session={session} units={sessionUnits} />}
        <div className="grid grid-cols-[1fr_auto] gap-3 items-start">
          <PartNameField
            inputRef={nameRef}
            value={form.name}
            error={errors.name}
            existing={existing}
            placeholder="Arduino Uno, ESP32, HC-SR04, multimeter…"
            onChange={name => set('name', name)}
            onPick={applyPart}
            onSearchOnline={q => setDigikeyRequest({ q, at: Date.now() })}
          />
          <QuantityField value={form.quantity} error={errors.quantity} onChange={v => set('quantity', v)} onStep={stepQuantity} />
        </div>
        {match && (
          <p className="text-[12.5px] rounded-md px-3 py-2" style={{ background: 'var(--adm-panel-raise)', color: 'var(--adm-silk-dim)' }}>
            Already {qty(match)} in stock{match.location ? ` on ${match.location}` : ''} ({match.asset_code}).
            {' '}Adding puts the count up to <strong>{qty(match) + (Number.isInteger(quantity) && quantity > 0 ? quantity : 0)}</strong>.
          </p>
        )}
        <DigiKeySearch key={digikeyKey} open={open} request={digikeyRequest} onPick={applyProduct} />
        <div className="grid sm:grid-cols-2 gap-4">
          <SelectField label="Category" value={form.category}
            onChange={e => { const category = e.target.value; setForm(f => ({ ...f, category, tracking_mode: defaultTracking(category) })) }}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </SelectField>
          <SelectField label="Condition" value={form.condition} onChange={e => set('condition', e.target.value)}>
            <option value="new">New</option>
            <option value="good">Good</option>
            <option value="worn">Worn</option>
            <option value="damaged">Damaged</option>
          </SelectField>
          <TrackingFields form={form} errors={errors} set={set} />
          <TextField label="Serial number" value={form.serial} onChange={e => set('serial', e.target.value)}
            hint="Only for a single, specific unit — it gets its own entry." />
          <ShelfSelect shelves={shelves} value={form.location} onChange={v => set('location', v)} onCreated={onShelfCreated} />
          <TextField label="Value (DA)" type="number" value={form.value} onChange={e => set('value', e.target.value)} />
        </div>
        <TextArea label="Notes" rows={4} value={form.notes} onChange={e => set('notes', e.target.value)} />
      </div>
    </Modal>
  )
}

/** "" → null, "3" → 3, anything else → undefined (invalid). */
function parseMinStock(raw) {
  if (String(raw).trim() === '') return null
  const n = Number(raw)
  return Number.isInteger(n) && n >= 0 ? n : undefined
}

/** What happens when it's taken, and the count that flags it as low. */
function TrackingFields({ form, errors = {}, set }) {
  return (
    <>
      <SelectField label="When someone takes it" value={form.tracking_mode} onChange={e => set('tracking_mode', e.target.value)}
        hint={form.tracking_mode === 'consumable' ? 'Borrowing hands it out for good by default.' : 'Borrowing lends it by default.'}>
        {TRACKING_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
      </SelectField>
      <TextField label="Low stock at (optional)" type="number" inputMode="numeric" min={0} step={1}
        value={form.min_stock} error={errors.min_stock} placeholder="e.g. 5"
        hint="Flagged when this many or fewer are on the shelf."
        onChange={e => set('min_stock', e.target.value)} />
    </>
  )
}

const NEW_SHELF = '__new_shelf__'

/**
 * Location as a dropdown of shelves. The last option creates a shelf on the
 * spot; a location typed before shelves existed is kept and still shown.
 */
function ShelfSelect({ shelves, value, onChange, onCreated }) {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef(null)
  const known = !value || shelves?.some(s => s.name === value)

  const create = async () => {
    if (!name.trim()) { setError('Enter the shelf name.'); return }
    setBusy(true)
    const shelf = await createShelf({ name })
    setBusy(false)
    if (!shelf) return
    logActivity('created', 'shelves', shelf.id, { name: shelf.name })
    onCreated?.(shelf)
    onChange(shelf.name)
    setCreating(false)
    setName('')
  }

  const cancel = () => { setCreating(false); setName(''); setError(null) }

  if (!shelves) {
    return <TextField label="Location" value={value} onChange={e => onChange(e.target.value)} placeholder="Lab shelf 2" />
  }

  if (creating) {
    return (
      <Field label="New shelf" error={error}>
        {a11y => (
          <div className="flex items-center gap-1.5">
            <input
              {...a11y}
              ref={inputRef}
              autoFocus
              className="adm-input"
              placeholder="Lab shelf 3, Drawer B2…"
              value={name}
              onChange={e => { setName(e.target.value); setError(null) }}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); create() }
                else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancel() }
              }}
            />
            <Button size="sm" variant="primary" onClick={create} busy={busy} busyLabel="Adding…">Add</Button>
            <Button size="sm" onClick={cancel} disabled={busy}>Cancel</Button>
          </div>
        )}
      </Field>
    )
  }

  return (
    <SelectField
      label="Location"
      value={value}
      onChange={e => (e.target.value === NEW_SHELF ? setCreating(true) : onChange(e.target.value))}
      hint={shelves.length ? undefined : 'No shelves yet — pick “New shelf…” to add one.'}
    >
      <option value="">No shelf</option>
      {!known && <option value={value}>{value} (not a shelf)</option>}
      {shelves.map(s => <option key={s.id} value={s.name}>{s.name}{s.code ? ` · ${s.code}` : ''}</option>)}
      <option value={NEW_SHELF}>+ New shelf…</option>
    </SelectField>
  )
}

function EditItem({ item, shelves, onShelfCreated, onClose, onSaved }) {
  const [form, setForm] = useState(null)
  const [error, setError] = useState(null)
  const [quantityError, setQuantityError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!item) return
    setForm({
      name: item.name || '',
      quantity: String(qty(item)),
      category: item.category || 'Other',
      tracking_mode: item.tracking_mode || 'returnable',
      min_stock: item.min_stock ?? '',
      condition: item.condition || 'good',
      status: item.status || 'available',
      serial: item.serial || '',
      location: item.location || '',
      value: item.value ?? '',
      notes: item.notes || '',
    })
    setError(null)
    setQuantityError(null)
  }, [item])

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }))
  // Borrowed and out of stock follow the count, so they can't be picked here.
  const counted = item?.status === 'borrowed' || item?.status === 'out_of_stock'
  const onLoan = item?.on_loan || 0
  const quantity = Number(form?.quantity)
  const minQuantity = item && form ? minQuantityFor({ ...item, tracking_mode: form.tracking_mode }) : 1

  const save = async () => {
    if (!form.name.trim()) { setError('Enter the item name.'); return }
    if (!Number.isInteger(quantity) || quantity < minQuantity) { setError(null); setQuantityError(onLoan ? `At least ${onLoan} — that many are out on loan.` : `A whole number, ${minQuantity} or more.`); return }
    const minStock = parseMinStock(form.min_stock)
    if (minStock === undefined) { setError('Low stock at: a whole number, 0 or more — or leave it empty.'); return }
    setSaving(true)
    // Loans themselves are opened and closed from Borrowing.
    const status = statusFor(item, quantity, counted ? 'available' : form.status)
    const changes = {
      name: form.name.trim(),
      quantity,
      category: form.category,
      tracking_mode: form.tracking_mode,
      min_stock: minStock,
      condition: form.condition,
      serial: form.serial.trim() || null,
      location: form.location || null,
      value: form.value === '' ? null : Number(form.value),
      notes: form.notes.trim() || null,
      updated_at: new Date().toISOString(),
      status,
    }
    const { ok } = await run(
      supabase.from('inventory_items').update(changes).eq('id', item.id),
      { success: 'Item saved.', failure: 'The item was not saved.' }
    )
    setSaving(false)
    if (ok) { logActivity('updated', 'inventory_items', item.id, { name: changes.name }); onSaved({ id: item.id, ...changes }) }
  }

  return (
    <Modal
      open={!!item}
      onClose={onClose}
      title="Edit item"
      description={item?.asset_code ? `${item.asset_code} — the asset code and QR label stay the same.` : undefined}
      footer={
        <>
          <Button onClick={onClose} data-dialog-dismiss="true">Cancel</Button>
          <Button variant="primary" onClick={save} busy={saving} busyLabel="Saving…">Save</Button>
        </>
      }
    >
      {form && (
        <div className="space-y-4" onKeyDown={e => {
          if (e.key === 'Enter' && !e.defaultPrevented && e.target.tagName === 'INPUT') { e.preventDefault(); save() }
        }}>
          <div className="grid grid-cols-[1fr_auto] gap-3 items-start">
            <TextField label="Name" required value={form.name} error={error}
              onChange={e => { set('name', e.target.value); setError(null) }} />
            <QuantityField
              value={form.quantity}
              error={quantityError}
              min={minQuantity}
              onChange={v => { set('quantity', v); setQuantityError(null) }}
              onStep={d => { set('quantity', String(Math.min(MAX_QUANTITY, Math.max(minQuantity, (Number.isInteger(quantity) ? quantity : minQuantity) + d)))); setQuantityError(null) }}
            />
          </div>
          {onLoan > 0 && (
            <p className="text-[12.5px]" style={{ color: 'var(--adm-silk-faint)' }}>{onLoan} out on loan right now.</p>
          )}
          <div className="grid sm:grid-cols-2 gap-4">
            <SelectField label="Category" value={form.category} onChange={e => set('category', e.target.value)}>
              {!CATEGORIES.includes(form.category) && <option value={form.category}>{form.category}</option>}
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </SelectField>
            <SelectField label="Condition" value={form.condition} onChange={e => set('condition', e.target.value)}>
              <option value="new">New</option>
              <option value="good">Good</option>
              <option value="worn">Worn</option>
              <option value="damaged">Damaged</option>
            </SelectField>
            <SelectField label="Status" value={counted ? item.status : form.status} disabled={counted}
              hint={counted ? (item.status === 'out_of_stock' ? 'None left — raise the quantity to restock.' : 'Out on loan — return it from Borrowing.') : undefined}
              onChange={e => set('status', e.target.value)}>
              {counted && <option value={item.status}>{item.status === 'out_of_stock' ? 'Out of stock' : 'Borrowed'}</option>}
              {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </SelectField>
            <ShelfSelect shelves={shelves} value={form.location} onChange={v => set('location', v)} onCreated={onShelfCreated} />
            <TrackingFields form={form} set={set} />
            <TextField label="Serial number" value={form.serial} onChange={e => set('serial', e.target.value)} />
            <TextField label="Value (DA)" type="number" value={form.value} onChange={e => set('value', e.target.value)} />
          </div>
          <TextArea label="Notes" rows={4} value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>
      )}
    </Modal>
  )
}

function QuantityField({ value, error, onChange, onStep, min = 1 }) {
  return (
    <Field label="Quantity" error={error} className="w-[132px]">
      {a11y => (
        <div className="flex items-center gap-1">
          <IconButton icon={Minus} label="One less" size={14} tabIndex={-1} onClick={() => onStep(-1)} disabled={Number(value) <= min} />
          <input
            {...a11y}
            className="adm-input adm-data text-center"
            type="number"
            inputMode="numeric"
            min={min}
            max={MAX_QUANTITY}
            step={1}
            value={value}
            onChange={e => onChange(e.target.value)}
            onFocus={e => e.target.select()}
          />
          <IconButton icon={Plus} label="One more" size={14} tabIndex={-1} onClick={() => onStep(1)} disabled={Number(value) >= MAX_QUANTITY} />
        </div>
      )}
    </Field>
  )
}

/** Running tally while "Add & next" keeps the dialog open. */
function AddedSoFar({ session, units }) {
  return (
    <div className="rounded-lg p-3" style={{ background: 'var(--adm-panel-raise)' }}>
      <p className="flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: 'var(--adm-ok)' }}>
        <CheckCircle2 size={14} aria-hidden="true" />
        {units} item{units === 1 ? '' : 's'} added or topped up
      </p>
      <ul className="mt-2 space-y-1 overflow-y-auto" style={{ maxHeight: 112 }}>
        {session.map(s => (
          <li key={s.id} className="flex items-baseline gap-2 text-[13px]">
            <span className="adm-data shrink-0" style={{ color: 'var(--adm-silk-dim)', minWidth: 40 }}>+{s.added}</span>
            <span className="adm-truncate flex-1 min-w-0">{s.name}</span>
            <span className="adm-data text-[11px] shrink-0" style={{ color: 'var(--adm-silk-faint)' }}>
              {s.merged ? `now ${s.quantity} · ` : ''}{s.asset_code}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Looks parts up through our /api/digikey proxy; picking one prefills the form. */
function DigiKeySearch({ open, request, onPick }) {
  const [expanded, setExpanded] = useState(false)
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState('boards')
  const [results, setResults] = useState([])
  const [picked, setPicked] = useState(null)
  const [state, setState] = useState({ loading: false, error: null, searched: false })

  useEffect(() => {
    if (open) { setExpanded(false); setQuery(''); setScope('boards'); setResults([]); setPicked(null); setState({ loading: false, error: null, searched: false }) }
  }, [open])

  const search = async (inScope = scope, text = query) => {
    const q = text.trim()
    if (q.length < 2) return
    setState({ loading: true, error: null, searched: true })
    const { ok, data, message } = await api(`/api/digikey/search?q=${encodeURIComponent(q)}&limit=8&scope=${inScope}`)
    setResults(ok ? data.products : [])
    setState({ loading: false, error: ok ? null : message, searched: true })
  }

  // "Search DigiKey for …" in the name suggestions lands here.
  useEffect(() => {
    if (!request) return
    setExpanded(true)
    setQuery(request.q)
    search(scope, request.q)
  }, [request]) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-run the current search when the scope flips, so results match the tab.
  const changeScope = value => {
    setScope(value)
    if (state.searched) search(value)
  }

  const pick = p => { setPicked(p.digikeyNumber || p.partNumber); onPick(p) }

  if (!expanded) {
    return (
      <button type="button" className="text-[12.5px] underline underline-offset-2" style={{ color: 'var(--adm-silk-dim)' }}
        onClick={() => setExpanded(true)}>
        Not in the suggestions? Search DigiKey
      </button>
    )
  }

  return (
    <div className="rounded-lg p-3 space-y-3" style={{ background: 'var(--adm-panel-raise)' }}>
      <div className="flex items-end gap-2">
        <TextField
          className="flex-1"
          label="Find on DigiKey"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); search() } }}
          placeholder="ESP32, LM7805, Arduino Uno…"
        />
        <Button icon={Search} onClick={() => search()} busy={state.loading} busyLabel="Searching…" disabled={query.trim().length < 2}>
          Search
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <FilterTabs options={DIGIKEY_SCOPES} value={scope} onChange={changeScope} label="DigiKey search scope" />
        <p className="text-[12px]" style={{ color: 'var(--adm-silk-faint)' }}>
          Pick a result to fill the form.
        </p>
      </div>

      {state.error && <p className="text-[13px]" style={{ color: 'var(--adm-fault)' }}>{state.error}</p>}
      {state.searched && !state.loading && !state.error && !results.length && (
        <p className="text-[13px]" style={{ color: 'var(--adm-silk-faint)' }}>No parts found.</p>
      )}

      {results.length > 0 && (
        <ul className="space-y-1 overflow-y-auto" style={{ maxHeight: 260 }}>
          {results.map(p => {
            const id = p.digikeyNumber || p.partNumber
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => pick(p)}
                  className="w-full flex items-center gap-3 rounded-md p-2 text-left"
                  style={{
                    background: picked === id ? 'var(--adm-panel)' : 'transparent',
                    outline: picked === id ? '1px solid var(--adm-silk-faint)' : 'none',
                  }}
                >
                  <span className="rounded overflow-hidden shrink-0" style={{ width: 40, height: 40, background: 'var(--adm-panel)' }}>
                    {p.photoUrl ? <img src={p.photoUrl} alt="" className="w-full h-full object-contain" loading="lazy" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold adm-truncate">{p.description || p.partNumber}</span>
                    <span className="adm-data block text-[11px] adm-truncate" style={{ color: 'var(--adm-silk-faint)' }}>
                      {[p.manufacturer, p.partNumber, p.category].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  {p.unitPrice != null && (
                    <span className="adm-data text-[12px] shrink-0" style={{ color: 'var(--adm-silk-dim)' }}>${p.unitPrice}</span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
