import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { Boxes, CheckCircle2, FileSpreadsheet, IdCard, Library, Loader2, Minus, PackagePlus, Pencil, Plus, Printer, Search, Trash2, Upload } from 'lucide-react'
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
import { CATEGORIES, MAX_QUANTITY } from '../lib/inventoryImport'
import { createShelf, loadShelves } from '../lib/shelves'

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'available', label: 'Available' },
  { value: 'borrowed', label: 'Borrowed' },
  { value: 'repair', label: 'In repair' },
  { value: 'retired', label: 'Retired' },
]

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
    () => (status === 'all' ? rows : rows.filter(r => r.status === status)),
    [rows, status]
  )

  const filterOptions = FILTERS.map(f => ({
    ...f,
    count: f.value === 'all' ? rows.length : rows.filter(r => r.status === f.value).length,
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

  const printLabels = items => {
    const ids = items.filter(i => i.asset_code).map(i => i.id)
    if (ids.length) navigate(`/admin/inventory/labels?ids=${ids.join(',')}`)
  }

  const exportHeaders = ['Asset code', 'Name', 'Category', 'Serial', 'Condition', 'Location', 'Status', 'Added']
  const exportRows = filtered.map(r => [r.asset_code, r.name, r.category, r.serial, r.condition, r.location, r.status, formatDate(r.created_at)])

  const columns = useMemo(() => [
    {
      header: 'Item',
      accessorKey: 'name',
      cell: ({ row }) => (
        <span className="min-w-0 block">
          <span className="block text-sm font-semibold adm-truncate" style={{ maxWidth: 220 }}>{row.original.name}</span>
          <span className="adm-data block text-[11px] adm-truncate" style={{ color: 'var(--adm-silk-faint)' }}>
            {row.original.asset_code}
          </span>
        </span>
      ),
    },
    { header: 'Category', accessorKey: 'category', cell: ({ row }) => (
      <span className="text-[13px]" style={{ color: 'var(--adm-silk-dim)' }}>{row.original.category || '—'}</span>
    )},
    { header: 'Location', accessorKey: 'location', cell: ({ row }) => (
      <span className="text-[13px]" style={{ color: 'var(--adm-silk-dim)' }}>{row.original.location || '—'}</span>
    )},
    { header: 'Condition', accessorKey: 'condition', cell: ({ row }) => (
      <span className="text-[13px] capitalize" style={{ color: 'var(--adm-silk-dim)' }}>{row.original.condition || '—'}</span>
    )},
    { header: 'Status', accessorKey: 'status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    {
      header: 'Added',
      accessorKey: 'created_at',
      cell: ({ row }) => <span className="adm-data text-[12px]">{formatDate(row.original.created_at)}</span>,
    },
  ], [])

  return (
    <div>
      <PageHeader
        eyebrow="Operate"
        title="Inventory"
        description="Electronics, tools and everything else the club owns. Each item gets a QR label to scan for borrowing."
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
        <DataTable
          columns={columns}
          data={filtered}
          loading={state.loading}
          initialSearch={search}
          getRowId={row => String(row.id)}
          onRowClick={setDetail}
          enableSelection
          bulkActions={selected => (
            <Button size="sm" variant="primary" icon={Printer} onClick={() => printLabels(selected)}>
              Print {selected.length} label{selected.length === 1 ? '' : 's'}
            </Button>
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
              <DetailRow label="Category">{detail.category || '—'}</DetailRow>
              <DetailRow label="Serial" mono>{detail.serial || '—'}</DetailRow>
              <DetailRow label="Condition">{detail.condition || '—'}</DetailRow>
              <DetailRow label="Location">{detail.location || '—'}</DetailRow>
              <DetailRow label="Value">{detail.value ? `${detail.value} DA` : '—'}</DetailRow>
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

const LABEL_CONCURRENCY = 8

/** The asset code comes from the row's own id, so it's assigned after insert. */
async function labelItem(id) {
  const assetCode = `INV-${String(id).padStart(5, '0')}`
  const qrCode = await QRCode.toDataURL(assetCode, { width: 300, margin: 2 })
  await run(supabase.from('inventory_items').update({ asset_code: assetCode, qr_code: qrCode }).eq('id', id))
}

/**
 * Adds one part, as one or more identical units — like the Excel import, each
 * unit is its own row with its own asset code and QR label. "Add & next"
 * keeps the dialog open with category, condition and location carried over,
 * so a box of parts can be entered one after another from the keyboard.
 */
function AddItem({ open, onClose, onAdded, existing, shelves, onShelfCreated }) {
  const navigate = useNavigate()
  const addToast = useAdminStore(s => s.addToast)
  const blank = { name: '', quantity: '1', category: 'Electronics', serial: '', condition: 'new', location: '', value: '', notes: '', photo_url: '' }
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
    if (Object.keys(next).length) { setErrors(next); if (next.name) nameRef.current?.focus(); return }
    setSaving(then)

    // The serial belongs to one physical unit, so only the first gets it.
    const unit = {
      name,
      category: form.category,
      condition: form.condition,
      location: form.location.trim() || null,
      value: form.value ? Number(form.value) : null,
      notes: form.notes.trim() || null,
      photo_url: form.photo_url || null,
      status: 'available',
    }
    const units = Array.from({ length: quantity }, (_, i) => ({ ...unit, serial: i === 0 ? form.serial.trim() || null : null }))

    const { ok, data } = await run(
      supabase.from('inventory_items').insert(units).select('id'),
      { failure: 'The item was not added.' }
    )
    if (!ok) { setSaving(null); return }

    // QR labels are generated in-browser — same lib the backend uses.
    const ids = data.map(r => r.id)
    let at = 0
    await Promise.all(Array.from({ length: Math.min(LABEL_CONCURRENCY, ids.length) }, async () => {
      while (at < ids.length) await labelItem(ids[at++])
    }))

    logActivity('created', 'inventory_items', ids[0], quantity > 1 ? { name, quantity } : { name })
    setSaving(null)
    onAdded()

    if (then === 'close') { onClose(); return }

    addToast(quantity > 1 ? `Added ${quantity} × ${name}.` : `Added ${name}.`, 'success')
    setSession(s => [{ name, quantity, ids, location: unit.location }, ...s])
    // Keep where it's stored and what kind of thing it is; clear what's per-part.
    setForm(f => ({ ...blank, category: f.category, condition: f.condition, location: f.location }))
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

  const sessionIds = session.flatMap(s => s.ids)
  const sessionUnits = sessionIds.length

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add items"
      description="Each unit gets its own asset code and QR label. Press Enter to add and start the next one."
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
        <DigiKeySearch key={digikeyKey} open={open} request={digikeyRequest} onPick={applyProduct} />
        <div className="grid sm:grid-cols-2 gap-4">
          <SelectField label="Category" value={form.category} onChange={e => set('category', e.target.value)}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </SelectField>
          <SelectField label="Condition" value={form.condition} onChange={e => set('condition', e.target.value)}>
            <option value="new">New</option>
            <option value="good">Good</option>
            <option value="worn">Worn</option>
            <option value="damaged">Damaged</option>
          </SelectField>
          <TextField label="Serial number" value={form.serial} onChange={e => set('serial', e.target.value)}
            hint={quantity > 1 ? 'Goes on the first unit only.' : undefined} />
          <ShelfSelect shelves={shelves} value={form.location} onChange={v => set('location', v)} onCreated={onShelfCreated} />
          <TextField label="Value (DA)" type="number" value={form.value} onChange={e => set('value', e.target.value)} />
        </div>
        <TextArea label="Notes" rows={4} value={form.notes} onChange={e => set('notes', e.target.value)} />
      </div>
    </Modal>
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

const STATUSES = [
  { value: 'available', label: 'Available' },
  { value: 'repair', label: 'In repair' },
  { value: 'retired', label: 'Retired' },
]

function EditItem({ item, shelves, onShelfCreated, onClose, onSaved }) {
  const [form, setForm] = useState(null)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!item) return
    setForm({
      name: item.name || '',
      category: item.category || 'Other',
      condition: item.condition || 'good',
      status: item.status || 'available',
      serial: item.serial || '',
      location: item.location || '',
      value: item.value ?? '',
      notes: item.notes || '',
    })
    setError(null)
  }, [item])

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }))
  const borrowed = item?.status === 'borrowed'

  const save = async () => {
    if (!form.name.trim()) { setError('Enter the item name.'); return }
    setSaving(true)
    const changes = {
      name: form.name.trim(),
      category: form.category,
      condition: form.condition,
      serial: form.serial.trim() || null,
      location: form.location || null,
      value: form.value === '' ? null : Number(form.value),
      notes: form.notes.trim() || null,
      updated_at: new Date().toISOString(),
      // A loan is closed from Borrowing, which also sets the status back.
      ...(borrowed ? {} : { status: form.status }),
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
          <TextField label="Name" required value={form.name} error={error}
            onChange={e => { set('name', e.target.value); setError(null) }} />
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
            <SelectField label="Status" value={borrowed ? 'borrowed' : form.status} disabled={borrowed}
              hint={borrowed ? 'Out on loan — return it from Borrowing.' : undefined}
              onChange={e => set('status', e.target.value)}>
              {borrowed && <option value="borrowed">Borrowed</option>}
              {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </SelectField>
            <ShelfSelect shelves={shelves} value={form.location} onChange={v => set('location', v)} onCreated={onShelfCreated} />
            <TextField label="Serial number" value={form.serial} onChange={e => set('serial', e.target.value)} />
            <TextField label="Value (DA)" type="number" value={form.value} onChange={e => set('value', e.target.value)} />
          </div>
          <TextArea label="Notes" rows={4} value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>
      )}
    </Modal>
  )
}

function QuantityField({ value, error, onChange, onStep }) {
  return (
    <Field label="Quantity" error={error} className="w-[132px]">
      {a11y => (
        <div className="flex items-center gap-1">
          <IconButton icon={Minus} label="One less" size={14} tabIndex={-1} onClick={() => onStep(-1)} disabled={Number(value) <= 1} />
          <input
            {...a11y}
            className="adm-input adm-data text-center"
            type="number"
            inputMode="numeric"
            min={1}
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
        Added {units} unit{units === 1 ? '' : 's'} of {session.length} part{session.length === 1 ? '' : 's'}
      </p>
      <ul className="mt-2 space-y-1 overflow-y-auto" style={{ maxHeight: 112 }}>
        {session.map(s => (
          <li key={s.ids[0]} className="flex items-baseline gap-2 text-[13px]">
            <span className="adm-data shrink-0" style={{ color: 'var(--adm-silk-dim)', minWidth: 32 }}>{s.quantity}×</span>
            <span className="adm-truncate flex-1 min-w-0">{s.name}</span>
            <span className="adm-data text-[11px] shrink-0" style={{ color: 'var(--adm-silk-faint)' }}>
              INV-{String(s.ids[0]).padStart(5, '0')}{s.ids.length > 1 ? ` → ${String(s.ids[s.ids.length - 1]).padStart(5, '0')}` : ''}
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
