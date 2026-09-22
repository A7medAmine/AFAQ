import { useCallback, useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { Boxes, IdCard, Loader2, PackagePlus, Search, Trash2, Upload } from 'lucide-react'
import { Link } from 'react-router-dom'
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
import Button from '../components/ui/Button'
import ExportMenu from '../components/ui/ExportMenu'
import { StatusBadge } from '../components/ui/Badge'
import Panel from '../components/ui/Panel'
import { SelectField, TextArea, TextField } from '../components/ui/Field'

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'available', label: 'Available' },
  { value: 'borrowed', label: 'Borrowed' },
  { value: 'repair', label: 'In repair' },
  { value: 'retired', label: 'Retired' },
]

export default function InventoryPage() {
  const addToast = useAdminStore(s => s.addToast)

  const [rows, setRows] = useState([])
  const [state, setState] = useState({ loading: true, error: null })
  const [status, setStatus] = useQueryParam('status', 'all')
  const [search] = useQueryParam('q')
  const [newFlag, setNewFlag] = useQueryParam('new')

  const [detail, setDetail] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [remove, setRemove] = useState(null)

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
              disabled={!filtered.length}
            />
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
          searchPlaceholder="Search by name, asset code, location…"
          toolbar={<FilterTabs options={filterOptions} value={status} onChange={setStatus} label="Status filter" />}
          emptyState={
            rows.length === 0 ? (
              <EmptyState
                icon={Boxes}
                title="Nothing in inventory yet"
                description="Add electronics, tools or equipment. Each one gets a unique asset code and a printable QR label."
                action={<Button variant="primary" icon={PackagePlus} onClick={() => setAddOpen(true)}>Add item</Button>}
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
              {detail.status !== 'retired' && (
                <Button icon={Trash2} onClick={() => setRemove(detail)}>Retire</Button>
              )}
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

      <AddItem open={addOpen} onClose={() => setAddOpen(false)} onAdded={load} />

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

const CATEGORIES = ['Electronics', 'Tools', 'Lab equipment', 'Furniture', 'Consumables', 'Other']

function AddItem({ open, onClose, onAdded }) {
  const blank = { name: '', category: 'Electronics', serial: '', condition: 'good', location: '', value: '', notes: '', photo_url: '' }
  const [form, setForm] = useState(blank)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (open) { setForm(blank); setErrors({}) } }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (key, value) => {
    setForm(f => ({ ...f, [key]: value }))
    setErrors(e => ({ ...e, [key]: undefined }))
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

  const submit = async () => {
    if (!form.name.trim()) { setErrors({ name: 'Enter the item name.' }); return }
    setSaving(true)

    const { ok, data } = await run(
      supabase.from('inventory_items').insert({
        name: form.name.trim(),
        category: form.category,
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
    if (!ok) { setSaving(false); return }

    // Asset code depends on the row's own id, so it's assigned right after
    // insert, then the QR (which just links to that code) is generated
    // in-browser — no server round trip needed, same lib the backend uses.
    const assetCode = `INV-${String(data.id).padStart(5, '0')}`
    const qrCode = await QRCode.toDataURL(assetCode, { width: 300, margin: 2 })
    await run(supabase.from('inventory_items').update({ asset_code: assetCode, qr_code: qrCode }).eq('id', data.id))

    logActivity('created', 'inventory_items', data.id, { name: form.name.trim() })
    setSaving(false)
    onClose()
    onAdded()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add an item"
      description="Gets a unique asset code and QR label automatically."
      footer={
        <>
          <Button onClick={onClose} data-dialog-dismiss="true">Cancel</Button>
          <Button variant="primary" onClick={submit} busy={saving} busyLabel="Adding…">Add item</Button>
        </>
      }
    >
      <div className="space-y-4">
        <DigiKeySearch open={open} onPick={applyProduct} />
        <TextField label="Name" required value={form.name} error={errors.name}
          onChange={e => set('name', e.target.value)} placeholder="Arduino Uno R3" />
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
          <TextField label="Serial number" value={form.serial} onChange={e => set('serial', e.target.value)} />
          <TextField label="Location" value={form.location} onChange={e => set('location', e.target.value)} placeholder="Lab shelf 2" />
          <TextField label="Value (DA)" type="number" value={form.value} onChange={e => set('value', e.target.value)} />
        </div>
        <TextArea label="Notes" rows={4} value={form.notes} onChange={e => set('notes', e.target.value)} />
      </div>
    </Modal>
  )
}

/** Looks parts up through our /api/digikey proxy; picking one prefills the form. */
function DigiKeySearch({ open, onPick }) {
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState('boards')
  const [results, setResults] = useState([])
  const [picked, setPicked] = useState(null)
  const [state, setState] = useState({ loading: false, error: null, searched: false })

  useEffect(() => {
    if (open) { setQuery(''); setScope('boards'); setResults([]); setPicked(null); setState({ loading: false, error: null, searched: false }) }
  }, [open])

  const search = async (inScope = scope) => {
    const q = query.trim()
    if (q.length < 2) return
    setState({ loading: true, error: null, searched: true })
    const { ok, data, message } = await api(`/api/digikey/search?q=${encodeURIComponent(q)}&limit=8&scope=${inScope}`)
    setResults(ok ? data.products : [])
    setState({ loading: false, error: ok ? null : message, searched: true })
  }

  // Re-run the current search when the scope flips, so results match the tab.
  const changeScope = value => {
    setScope(value)
    if (state.searched) search(value)
  }

  const pick = p => { setPicked(p.digikeyNumber || p.partNumber); onPick(p) }

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
