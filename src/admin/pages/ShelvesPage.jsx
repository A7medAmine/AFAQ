import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Library, Plus, Printer, Trash2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { logActivity, read, run, supabase } from '../lib/db'
import { createShelf, loadShelves, updateShelf } from '../lib/shelves'
import PageHeader from '../components/ui/PageHeader'
import DataTable from '../components/ui/DataTable'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import EmptyState, { ErrorState } from '../components/ui/EmptyState'
import Button from '../components/ui/Button'
import Panel from '../components/ui/Panel'
import { TextField } from '../components/ui/Field'

/**
 * Where inventory lives. Each shelf gets a code (SHF-001) and a QR label to
 * stick on it; items pick their shelf from a dropdown when they're added.
 */
export default function ShelvesPage() {
  const navigate = useNavigate()
  const [shelves, setShelves] = useState([])
  const [counts, setCounts] = useState(new Map())
  const [state, setState] = useState({ loading: true, error: null })
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null)
  const [remove, setRemove] = useState(null)

  const load = useCallback(async () => {
    setState(s => ({ ...s, error: null }))
    const [shelfRes, itemRes] = await Promise.all([
      loadShelves(),
      read(supabase.from('inventory_items').select('location').neq('status', 'retired')),
    ])
    if (!shelfRes.ok) { setState({ loading: false, error: shelfRes.message }); return }
    const byName = new Map()
    for (const { location } of itemRes.data || []) {
      if (location) byName.set(location, (byName.get(location) || 0) + 1)
    }
    setShelves(shelfRes.data || [])
    setCounts(byName)
    setState({ loading: false, error: null })
  }, [])

  useEffect(() => { load() }, [load])

  const rows = useMemo(() => shelves.map(s => ({ ...s, items: counts.get(s.name) || 0 })), [shelves, counts])

  const printLabels = list => {
    const ids = list.filter(s => s.code).map(s => s.id)
    if (ids.length) navigate(`/admin/inventory/shelves/labels?ids=${ids.join(',')}`)
  }

  const destroy = async shelf => {
    const { ok } = await run(
      supabase.from('shelves').delete().eq('id', shelf.id),
      { success: `${shelf.name} deleted.`, failure: 'The shelf was not deleted.' }
    )
    if (ok) { logActivity('deleted', 'shelves', shelf.id, { name: shelf.name }); setRemove(null); setEditing(null); await load() }
  }

  const columns = useMemo(() => [
    {
      header: 'Shelf',
      accessorKey: 'name',
      cell: ({ row }) => (
        <span className="min-w-0 block">
          <span className="block text-sm font-semibold adm-truncate" style={{ maxWidth: 260 }}>{row.original.name}</span>
          <span className="adm-data block text-[11px]" style={{ color: 'var(--adm-silk-faint)' }}>{row.original.code}</span>
        </span>
      ),
    },
    { header: 'Description', accessorKey: 'description', cell: ({ row }) => (
      <span className="text-[13px]" style={{ color: 'var(--adm-silk-dim)' }}>{row.original.description || '—'}</span>
    )},
    { header: 'Items', accessorKey: 'items', cell: ({ row }) => (
      <span className="adm-data text-[13px]">{row.original.items}</span>
    )},
  ], [])

  return (
    <div>
      <PageHeader
        eyebrow="Inventory"
        title="Shelves"
        description="Where things are kept. Each shelf gets a code and a QR label, and shows up in the location dropdown when adding items."
        actions={
          <>
            <Link to="/admin/inventory" className="adm-btn"><ArrowLeft size={15} /> Inventory</Link>
            <Button icon={Printer} disabled={!rows.length} onClick={() => printLabels(rows)}>Print all labels</Button>
            <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>Add shelf</Button>
          </>
        }
      />

      {state.error ? (
        <Panel><ErrorState message={state.error} onRetry={load} /></Panel>
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          loading={state.loading}
          getRowId={row => String(row.id)}
          onRowClick={setEditing}
          enableSelection
          bulkActions={selected => (
            <Button size="sm" variant="primary" icon={Printer} onClick={() => printLabels(selected)}>
              Print {selected.length} label{selected.length === 1 ? '' : 's'}
            </Button>
          )}
          searchPlaceholder="Search shelves…"
          emptyState={
            <EmptyState
              icon={Library}
              title="No shelves yet"
              description="Add the shelves, drawers and cabinets the club stores things in, then print a label for each."
              action={<Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>Add shelf</Button>}
            />
          }
        />
      )}

      <AddShelves open={adding} onClose={() => setAdding(false)} onAdded={load} />
      <EditShelf
        shelf={editing}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); load() }}
        onDelete={() => setRemove(editing)}
        onPrint={() => printLabels([editing])}
      />

      <ConfirmDialog
        open={!!remove}
        onClose={() => setRemove(null)}
        onConfirm={() => destroy(remove)}
        title="Delete this shelf?"
        message={remove
          ? remove.items
            ? `${remove.items} item${remove.items === 1 ? '' : 's'} still list “${remove.name}” as their location. They keep that text, but the shelf leaves the dropdown.`
            : `${remove.name} will leave the location dropdown.`
          : ''}
      />
    </div>
  )
}

/** Like adding items: Enter adds and clears the form for the next shelf. */
function AddShelves({ open, onClose, onAdded }) {
  const [form, setForm] = useState({ name: '', description: '' })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(null)
  const [added, setAdded] = useState([])
  const nameRef = useRef(null)

  useEffect(() => { if (open) { setForm({ name: '', description: '' }); setError(null); setAdded([]) } }, [open])

  const submit = async then => {
    if (saving) return
    if (!form.name.trim()) { setError('Enter the shelf name.'); nameRef.current?.focus(); return }
    setSaving(then)
    const shelf = await createShelf(form)
    setSaving(null)
    if (!shelf) return
    logActivity('created', 'shelves', shelf.id, { name: shelf.name })
    onAdded()
    if (then === 'close') { onClose(); return }
    setAdded(a => [shelf, ...a])
    setForm({ name: '', description: '' })
    requestAnimationFrame(() => nameRef.current?.focus())
  }

  const onKeyDown = e => {
    if (e.key !== 'Enter' || e.target.tagName !== 'INPUT' || e.nativeEvent.isComposing) return
    e.preventDefault()
    submit(e.ctrlKey || e.metaKey ? 'close' : 'next')
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Add shelves"
      description="Press Enter to add and type the next one."
      footer={
        <>
          <Button onClick={onClose} data-dialog-dismiss="true">{added.length ? 'Done' : 'Cancel'}</Button>
          <Button onClick={() => submit('close')} busy={saving === 'close'} busyLabel="Adding…" disabled={!!saving}>Add & close</Button>
          <Button variant="primary" icon={Plus} onClick={() => submit('next')} busy={saving === 'next'} busyLabel="Adding…" disabled={!!saving}>Add & next</Button>
        </>
      }
    >
      <div className="space-y-4" onKeyDown={onKeyDown}>
        {added.length > 0 && (
          <p className="text-[12.5px]" style={{ color: 'var(--adm-ok)' }}>
            Added {added.map(s => `${s.name} (${s.code})`).join(', ')}
          </p>
        )}
        <TextField
          ref={nameRef}
          label="Name"
          required
          autoFocus
          value={form.name}
          error={error}
          placeholder="Lab shelf 1, Drawer A3, Tool cabinet…"
          onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setError(null) }}
        />
        <TextField
          label="Description"
          value={form.description}
          placeholder="Optional — what's kept there, which room"
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
        />
      </div>
    </Modal>
  )
}

function EditShelf({ shelf, onClose, onSaved, onDelete, onPrint }) {
  const [form, setForm] = useState({ name: '', description: '' })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (shelf) { setForm({ name: shelf.name, description: shelf.description || '' }); setError(null) }
  }, [shelf])

  const save = async () => {
    if (!form.name.trim()) { setError('Enter the shelf name.'); return }
    setSaving(true)
    const ok = await updateShelf(shelf, form)
    setSaving(false)
    if (ok) { logActivity('updated', 'shelves', shelf.id, { name: form.name.trim() }); onSaved() }
  }

  return (
    <Modal
      open={!!shelf}
      onClose={onClose}
      size="sm"
      title={shelf ? `${shelf.name}` : ''}
      description={shelf ? `${shelf.code} · ${shelf.items} item${shelf.items === 1 ? '' : 's'}` : ''}
      footer={
        <>
          <Button className="mr-auto" icon={Trash2} onClick={onDelete}>Delete</Button>
          <Button icon={Printer} onClick={onPrint}>Print label</Button>
          <Button variant="primary" onClick={save} busy={saving} busyLabel="Saving…">Save</Button>
        </>
      }
    >
      <div className="space-y-4" onKeyDown={e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); save() } }}>
        <TextField
          label="Name"
          required
          value={form.name}
          error={error}
          hint={shelf?.items && form.name.trim() !== shelf.name ? `Its ${shelf.items} item${shelf.items === 1 ? '' : 's'} move to the new name too.` : undefined}
          onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setError(null) }}
        />
        <TextField
          label="Description"
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
        />
      </div>
    </Modal>
  )
}
