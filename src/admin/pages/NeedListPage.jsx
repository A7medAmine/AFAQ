import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Archive, ArrowLeft, ArrowLeftRight, BookmarkPlus, CalendarDays, CheckCircle2, ClipboardList, Copy, FileSpreadsheet, History, Layers,
  LayoutGrid, Mail, PackagePlus, Pencil, Plus, Printer, RotateCcw, Search, Share2, Star, Table2, Trash2, TrendingDown, UserRound,
} from 'lucide-react'
import { api, logActivity, read, run, supabase } from '../lib/db'
import useAdminStore from '../store/adminStore'
import { formatDate, formatDateTime } from '../lib/format'
import {
  ITEM_STATUSES, KINDS, SOURCES, UNITS, canCheckOut, canStock, duplicateList, isLate, itemStatusLabel, kindLabel, listContext,
  loadAdminDirectory, loadDepartments, onShelf, priorityLabel, progressOf, scopeLabel, sourceLabel,
} from '../lib/needs'
import PageHeader, { FilterTabs } from '../components/ui/PageHeader'
import EmptyState, { ErrorState } from '../components/ui/EmptyState'
import Button, { IconButton } from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Panel from '../components/ui/Panel'
import Skeleton from '../components/ui/Skeleton'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import ExportMenu from '../components/ui/ExportMenu'
import DepartmentsModal from '../components/needs/DepartmentsModal'
import ListFormModal from '../components/needs/ListFormModal'
import PrintNeedsModal from '../components/needs/PrintNeedsModal'
import ImportNeedsModal from '../components/needs/ImportNeedsModal'
import ReceiveModal from '../components/needs/ReceiveModal'
import CheckoutModal from '../components/needs/CheckoutModal'
import LowStockModal from '../components/needs/LowStockModal'
import HistoryDrawer from '../components/needs/HistoryDrawer'
import ShareModal from '../components/needs/ShareModal'
import NeedsBoard from '../components/needs/NeedsBoard'

const NO_DEPT = 'none'
const STATUS_COLOR = { needed: 'var(--adm-wait)', ordered: 'var(--adm-signal)', ready: 'var(--adm-ok)', cancelled: 'var(--adm-trace-strong)' }

/** Cells read the save function from here so the rows don't remount on every change. */
const Edit = createContext({ patch: async () => false, departments: [], stock: new Map() })

const VIEW_KEY = 'afaq.needs.view'
const savedView = () => { try { return localStorage.getItem(VIEW_KEY) === 'board' ? 'board' : 'table' } catch { return 'table' } }

export default function NeedListPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const addToast = useAdminStore(s => s.addToast)
  const me = useAdminStore(s => s.adminProfile)

  const [list, setList] = useState(null)
  const [items, setItems] = useState([])
  const [departments, setDepartments] = useState([])
  const [events, setEvents] = useState([])
  const [inventory, setInventory] = useState([])
  const [state, setState] = useState({ loading: true, error: null })

  const [dept, setDept] = useState('all')
  const [statusFilter, setStatusFilter] = useState('')
  const [kindFilter, setKindFilter] = useState('')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(() => new Set())
  const [mine, setMine] = useState(false)
  const [view, setViewState] = useState(savedView)
  const setView = next => { setViewState(next); try { localStorage.setItem(VIEW_KEY, next) } catch { /* storage blocked */ } }
  const [people, setPeople] = useState({ admins: [], members: [] })

  const [editing, setEditing] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [deptOpen, setDeptOpen] = useState(false)
  const [confirm, setConfirm] = useState(null) // 'delete-list' | 'delete-items'
  const [receiving, setReceiving] = useState(null) // items to put in inventory
  const [checkingOut, setCheckingOut] = useState(false)
  const [lowStock, setLowStock] = useState(false)
  const [historyItem, setHistoryItem] = useState(null)
  const [sharing, setSharing] = useState(false)
  const [reminding, setReminding] = useState(false)

  const loadDepts = useCallback(async () => {
    const { ok, data } = await loadDepartments()
    if (ok) setDepartments(data || [])
  }, [])

  const load = useCallback(async () => {
    setState(s => ({ ...s, error: null }))
    const [listRes, itemRes, eventRes, invRes] = await Promise.all([
      read(supabase.from('need_lists').select('*, event:events(id, title_en, date), department:departments(id, name, color)').eq('id', id).maybeSingle()),
      read(supabase.from('need_items').select('*').eq('list_id', id).order('created_at')),
      read(supabase.from('events').select('id, title_en, date').order('date', { ascending: false })),
      read(supabase.from('inventory_items').select('id, name, asset_code, quantity, on_loan, tracking_mode, status, min_stock').neq('status', 'retired').order('name')),
    ])
    if (!listRes.ok || !itemRes.ok) { setState({ loading: false, error: (listRes.ok ? itemRes : listRes).message }); return }
    if (!listRes.data) { setState({ loading: false, error: 'This list does not exist any more.' }); return }
    setList(listRes.data)
    setItems(itemRes.data || [])
    setEvents(eventRes.data || [])
    setInventory(invRes.data || [])
    setState({ loading: false, error: null })
  }, [id])

  useEffect(() => { load(); loadDepts() }, [load, loadDepts])

  // People to assign items to. Members are only readable by roles that
  // manage membership; for others the list is admins only.
  useEffect(() => {
    Promise.all([
      loadAdminDirectory(),
      read(supabase.from('members').select('id, full_name, email').eq('status', 'active').order('full_name')),
    ]).then(([admins, members]) => setPeople({ admins: admins.data || [], members: members.ok ? members.data || [] : [] }))
  }, [])

  const stock = useMemo(() => new Map(inventory.map(i => [i.id, i])), [inventory])
  const deptById = useMemo(() => new Map(departments.map(d => [d.id, d])), [departments])

  /** One field change; the row updates at once and rolls back if the save fails. */
  const patch = useCallback(async (item, changes) => {
    const before = item
    const apply = values => setItems(rs => rs.map(r => (r.id === item.id ? { ...r, ...values } : r)))
    apply(changes)
    const { ok } = await run(
      supabase.from('need_items').update({ ...changes, updated_at: new Date().toISOString() }).eq('id', item.id),
      { failure: `${item.name} was not saved.` }
    )
    if (!ok) { apply(Object.fromEntries(Object.keys(changes).map(k => [k, before[k]]))); return false }
    logActivity('updated', 'need_items', item.id, { name: changes.name || item.name, list: list?.title, ...changes })
    return true
  }, [list?.title])

  const addItem = async values => {
    const { ok, data } = await run(
      supabase.from('need_items').insert({ ...values, list_id: Number(id) }).select('*').single(),
      { failure: 'The item was not added.' }
    )
    if (!ok) return false
    logActivity('created', 'need_items', data.id, { name: data.name, list: list.title })
    setItems(rs => [...rs, data])
    return true
  }

  const bulk = async changes => {
    const ids = [...selected]
    const { ok } = await run(
      supabase.from('need_items').update({ ...changes, updated_at: new Date().toISOString() }).in('id', ids),
      { success: `Updated ${ids.length} item${ids.length === 1 ? '' : 's'}.`, failure: 'Nothing was changed.' }
    )
    if (!ok) return
    // One entry per item, so each item's history shows the change.
    const touched = items.filter(r => selected.has(r.id))
    touched.forEach(r => logActivity('updated', 'need_items', r.id, { name: r.name, list: list.title, ...changes }))
    setItems(rs => rs.map(r => (selected.has(r.id) ? { ...r, ...changes } : r)))
    setSelected(new Set())
    if (changes.status === 'ready') {
      const arrived = touched.map(r => ({ ...r, ...changes })).filter(canStock)
      if (arrived.length) setReceiving(arrived)
    }
  }

  /** A status change; something bought or made that is now ready can go straight into inventory. */
  const setStatus = useCallback(async (item, status) => {
    const ok = await patch(item, { status })
    if (ok && canStock({ ...item, status })) setReceiving([{ ...item, status }])
    return ok
  }, [patch])

  const remind = async () => {
    setReminding(true)
    const { ok, data, message } = await api(`/api/needs/${list.id}/remind`, { method: 'POST' })
    setReminding(false)
    if (!ok) { addToast(message, 'error'); return }
    const parts = [`Sent ${data.sent} reminder${data.sent === 1 ? '' : 's'}.`]
    if (data.unreachable) parts.push(`${data.unreachable} item${data.unreachable === 1 ? ' has' : 's have'} a name typed by hand, so no email.`)
    if (data.failed) parts.push(`${data.failed} failed.`)
    addToast(parts.join(' '), data.failed ? 'error' : 'success')
    logActivity('updated', 'need_lists', list.id, { name: list.title, reminders: data.sent })
  }

  const saveAsTemplate = async () => {
    const newId = await duplicateList(list, items, `${list.title} (template)`, { isTemplate: true, createdBy: me?.user_id })
    if (!newId) return
    logActivity('created', 'need_lists', newId, { name: `${list.title} (template)`, template: true, copied_from: list.id })
    addToast('Saved as a template. Start new lists from it under Templates.')
  }

  const startFromTemplate = async () => {
    const title = list.title.replace(/\s*\(template\)$/i, '')
    const newId = await duplicateList(list, items, title, { createdBy: me?.user_id })
    if (!newId) return
    logActivity('created', 'need_lists', newId, { name: title, from_template: list.id })
    addToast('New list started from the template.')
    navigate(`/admin/needs/${newId}`)
  }

  const deleteSelected = async () => {
    const ids = [...selected]
    const { ok } = await run(supabase.from('need_items').delete().in('id', ids),
      { success: `Removed ${ids.length} item${ids.length === 1 ? '' : 's'}.`, failure: 'Nothing was removed.' })
    if (!ok) return
    logActivity('deleted', 'need_items', null, { name: 'Bulk delete', list: list.title, count: ids.length })
    setItems(rs => rs.filter(r => !selected.has(r.id)))
    setSelected(new Set())
    setConfirm(null)
  }

  const removeItem = async item => {
    const { ok } = await run(supabase.from('need_items').delete().eq('id', item.id), { failure: `${item.name} was not removed.` })
    if (!ok) return
    logActivity('deleted', 'need_items', item.id, { name: item.name, list: list.title })
    setItems(rs => rs.filter(r => r.id !== item.id))
    setSelected(s => { const n = new Set(s); n.delete(item.id); return n })
  }

  const setListStatus = async status => {
    const { ok } = await run(
      supabase.from('need_lists').update({ status, updated_at: new Date().toISOString() }).eq('id', list.id),
      { success: status === 'open' ? 'List reopened.' : status === 'done' ? 'List marked done.' : 'List archived.', failure: 'The list did not change.' }
    )
    if (!ok) return
    logActivity('updated', 'need_lists', list.id, { name: list.title, status })
    setList(l => ({ ...l, status }))
  }

  const deleteList = async () => {
    const { ok } = await run(supabase.from('need_lists').delete().eq('id', list.id),
      { success: `${list.title} deleted.`, failure: 'The list was not deleted.' })
    if (!ok) return
    logActivity('deleted', 'need_lists', list.id, { name: list.title, items: items.length })
    navigate('/admin/needs')
  }

  const copyList = async () => {
    const newId = await duplicateList(list, items, `${list.title} (copy)`)
    if (!newId) return
    logActivity('created', 'need_lists', newId, { name: `${list.title} (copy)`, copied_from: list.id })
    addToast('List copied. Every item starts again as needed.')
    navigate(`/admin/needs/${newId}`)
  }

  // ── Filtering and grouping ─────────────────────────────────────────────
  const matches = useCallback(item => {
    if (mine && item.assignee_user_id !== me?.user_id) return false
    if (statusFilter && item.status !== statusFilter) return false
    if (kindFilter && item.kind !== kindFilter) return false
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      if (![item.name, item.notes, item.assignee].some(v => v && v.toLowerCase().includes(q))) return false
    }
    return true
  }, [statusFilter, kindFilter, query, mine, me?.user_id])

  const groups = useMemo(() => {
    const keyOf = item => (item.department_id && deptById.has(item.department_id) ? item.department_id : NO_DEPT)
    const order = [...departments.map(d => d.id), NO_DEPT]
    return order
      .filter(key => dept === 'all' || String(key) === String(dept))
      .map(key => {
        const all = items.filter(i => keyOf(i) === key)
        return { key, dept: deptById.get(key) || null, all, shown: all.filter(matches) }
      })
      .filter(g => g.all.length)
  }, [items, departments, deptById, dept, matches])

  const deptTabs = useMemo(() => {
    const count = key => items.filter(i => (key === NO_DEPT ? !i.department_id || !deptById.has(i.department_id) : i.department_id === key)).length
    const tabs = [{ value: 'all', label: 'All', count: items.length }]
    departments.forEach(d => { const n = count(d.id); if (n) tabs.push({ value: String(d.id), label: d.name, count: n }) })
    const none = count(NO_DEPT)
    if (none) tabs.push({ value: NO_DEPT, label: 'No department', count: none })
    return tabs
  }, [items, departments, deptById])

  const visibleIds = groups.flatMap(g => g.shown.map(i => i.id))
  const progress = progressOf(items)

  const exportRows = items.map(i => [
    deptById.get(i.department_id)?.name || '', i.name, i.quantity, i.unit || '', kindLabel(i.kind), sourceLabel(i.source),
    itemStatusLabel(i.status), priorityLabel(i.priority), i.assignee || '', i.supplier || '', i.notes || '',
  ])

  const toStock = items.filter(canStock)
  const toCheckOut = items.filter(canCheckOut)
  const lowCount = inventory.filter(i => i.min_stock != null && onShelf(i) <= i.min_stock
    && !items.some(n => n.inventory_item_id === i.id && n.status !== 'cancelled')).length
  const myCount = items.filter(i => i.assignee_user_id && i.assignee_user_id === me?.user_id).length
  const boardItems = groups.flatMap(g => g.shown)

  const editCtx = useMemo(
    () => ({ patch, setStatus, departments, stock, people, remove: removeItem, history: setHistoryItem }),
    [patch, setStatus, departments, stock, people] // eslint-disable-line react-hooks/exhaustive-deps
  )

  if (state.error) {
    return (
      <div>
        <Link to="/admin/needs" className="adm-btn mb-5 inline-flex"><ArrowLeft size={15} /> Needs lists</Link>
        <Panel><ErrorState message={state.error} onRetry={load} /></Panel>
      </div>
    )
  }

  if (state.loading || !list) {
    return (
      <div>
        <Skeleton style={{ height: 28, width: 280, marginBottom: 12 }} />
        <Skeleton style={{ height: 14, width: 200, marginBottom: 28 }} />
        <Panel className="p-5"><Skeleton style={{ height: 200 }} /></Panel>
      </div>
    )
  }

  const late = isLate(list)

  return (
    <div>
      <PageHeader
        eyebrow={scopeLabel(list.scope)}
        title={list.title}
        actions={
          <>
            <Link to="/admin/needs" className="adm-btn"><ArrowLeft size={15} /> Lists</Link>
            <ExportMenu
              filename={`needs-${list.id}-${new Date().toISOString().slice(0, 10)}`}
              title="Needs list"
              subtitle={`${list.title} · ${formatDateTime(new Date())}`}
              headers={['Department', 'Item', 'Quantity', 'Unit', 'Type', 'Source', 'Status', 'Priority', 'Who', 'Supplier', 'Notes']}
              rows={exportRows}
              statusColumnIndex={6}
              enumColumns={[4, 5, 6, 7]}
              disabled={!items.length}
            />
            <Button icon={FileSpreadsheet} onClick={() => setImporting(true)}>Import</Button>
            <Button variant="primary" icon={Printer} onClick={() => setPrinting(true)}>Print</Button>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2 text-[13px]" style={{ color: 'var(--adm-silk-dim)' }}>
          <span>{listContext(list)}</span>
          {list.due_date && (
            <span className="inline-flex items-center gap-1" style={{ color: late ? 'var(--adm-fault)' : undefined }}>
              <CalendarDays size={13} /> {late ? 'Late — was needed by' : 'Needed by'} {formatDate(list.due_date)}
            </span>
          )}
          {list.is_template && <Badge tone="signal">Template</Badge>}
          {!list.is_template && list.status !== 'open' && <Badge tone={list.status === 'done' ? 'ok' : undefined}>{list.status === 'done' ? 'Done' : 'Archived'}</Badge>}
          {list.share_token && <Badge>Shared by link</Badge>}
        </div>
        {list.notes && <p className="text-[13px] mt-2 whitespace-pre-line" style={{ color: 'var(--adm-silk-faint)', maxWidth: 680 }}>{list.notes}</p>}
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <div className="flex items-center gap-3 mr-auto min-w-[220px]">
          <div className="rounded-full overflow-hidden flex-1" style={{ height: 8, background: 'var(--adm-board-sunk)', maxWidth: 260 }}>
            <div style={{ width: `${progress.pct}%`, height: '100%', background: progress.pct === 100 ? 'var(--adm-ok)' : 'var(--adm-signal)' }} />
          </div>
          <span className="text-[13px] adm-data" style={{ color: 'var(--adm-silk-dim)' }}>
            {progress.total ? `${progress.ready} / ${progress.total} ready` : 'No items yet'}
          </span>
        </div>
        <Button size="sm" icon={Pencil} onClick={() => setEditing(true)}>Edit list</Button>
        <Button size="sm" icon={Layers} onClick={() => setDeptOpen(true)}>Departments</Button>
        {list.is_template ? (
          <Button size="sm" variant="primary" icon={Plus} onClick={startFromTemplate}>New list from this template</Button>
        ) : (
          <>
            <Button size="sm" icon={Copy} onClick={copyList}>Copy</Button>
            <Button size="sm" icon={BookmarkPlus} onClick={saveAsTemplate}>Save as template</Button>
            <Button size="sm" icon={Share2} onClick={() => setSharing(true)}>Share</Button>
            {list.status === 'open' ? (
              <>
                <Button size="sm" icon={CheckCircle2} onClick={() => setListStatus('done')}>Mark done</Button>
                <Button size="sm" icon={Archive} onClick={() => setListStatus('archived')}>Archive</Button>
              </>
            ) : (
              <Button size="sm" icon={RotateCcw} onClick={() => setListStatus('open')}>Reopen</Button>
            )}
          </>
        )}
        <Button size="sm" variant="danger" icon={Trash2} onClick={() => setConfirm('delete-list')}>Delete</Button>
      </div>

      {!list.is_template && (toCheckOut.length > 0 || toStock.length > 0 || lowCount > 0 || items.some(i => i.assignee_user_id || i.assignee_member_id)) && (
        <div className="flex flex-wrap items-center gap-2 mb-5 p-3 rounded-xl" style={{ background: 'var(--adm-panel-raise)' }}>
          <span className="text-[12px] font-semibold mr-1" style={{ color: 'var(--adm-silk-dim)' }}>Next steps</span>
          {toCheckOut.length > 0 && (
            <Button size="sm" icon={ArrowLeftRight} onClick={() => setCheckingOut(true)}>Check out {toCheckOut.length} from stock</Button>
          )}
          {toStock.length > 0 && (
            <Button size="sm" icon={PackagePlus} onClick={() => setReceiving(toStock)}>Add {toStock.length} arrived to inventory</Button>
          )}
          {lowCount > 0 && (
            <Button size="sm" icon={TrendingDown} onClick={() => setLowStock(true)}>{lowCount} low in inventory</Button>
          )}
          {items.some(i => (i.assignee_user_id || i.assignee_member_id) && (i.status === 'needed' || i.status === 'ordered')) && (
            <Button size="sm" icon={Mail} busy={reminding} busyLabel="Sending…" onClick={remind}>Email reminders</Button>
          )}
        </div>
      )}

      <QuickAdd
        departments={departments}
        inventory={inventory}
        defaultDept={list.scope === 'department' ? list.department_id : dept !== 'all' && dept !== NO_DEPT ? Number(dept) : null}
        onAdd={addItem}
      />

      {items.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mt-6 mb-3">
          <FilterTabs options={deptTabs} value={String(dept)} onChange={setDept} label="Department" />
          <div className="flex flex-wrap items-center gap-2 ml-auto">
            <label className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--adm-silk-faint)' }} />
              <input className="adm-input" style={{ paddingLeft: 30, width: 200 }} placeholder="Search items…" aria-label="Search items"
                value={query} onChange={e => setQuery(e.target.value)} />
            </label>
            <select className="adm-input" style={{ width: 'auto' }} aria-label="Status filter" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">Any status</option>
              {ITEM_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <select className="adm-input" style={{ width: 'auto' }} aria-label="Type filter" value={kindFilter} onChange={e => setKindFilter(e.target.value)}>
              <option value="">Any type</option>
              {KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
            {myCount > 0 && (
              <Button size="sm" variant={mine ? 'primary' : 'default'} icon={UserRound} onClick={() => setMine(m => !m)} aria-pressed={mine}>
                My items ({myCount})
              </Button>
            )}
            <span className="inline-flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--adm-trace)' }} role="group" aria-label="View">
              <IconButton icon={Table2} label="Table view" onClick={() => setView('table')} aria-pressed={view === 'table'}
                style={{ background: view === 'table' ? 'var(--adm-panel-raise)' : undefined, borderRadius: 0 }} />
              <IconButton icon={LayoutGrid} label="Board view" onClick={() => setView('board')} aria-pressed={view === 'board'}
                style={{ background: view === 'board' ? 'var(--adm-panel-raise)' : undefined, borderRadius: 0 }} />
            </span>
          </div>
        </div>
      )}

      {selected.size > 0 && view === 'table' && (
        <div className="flex flex-wrap items-center gap-2 mb-3 p-2.5 rounded-xl"
          style={{ background: 'var(--adm-signal-wash, var(--adm-panel-raise))', border: '1px solid var(--adm-signal-edge, var(--adm-trace))' }}>
          <span className="text-[13px] font-semibold px-1">{selected.size} selected</span>
          <BulkSelect label="Set status…" onPick={v => bulk({ status: v })}>
            {ITEM_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </BulkSelect>
          <BulkSelect label="Move to…" onPick={v => bulk({ department_id: v === NO_DEPT ? null : Number(v) })}>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            <option value={NO_DEPT}>No department</option>
          </BulkSelect>
          <BulkSelect label="Source…" onPick={v => bulk({ source: v })}>
            {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </BulkSelect>
          <Button size="sm" variant="danger" icon={Trash2} onClick={() => setConfirm('delete-items')}>Remove</Button>
          <Button size="sm" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}

      {items.length === 0 ? (
        <Panel className="mt-6">
          <EmptyState icon={ClipboardList} title="Nothing on this list yet"
            description="Add what is needed above, or bring a whole list in from Excel or CSV."
            action={<Button icon={FileSpreadsheet} onClick={() => setImporting(true)}>Import from Excel</Button>} />
        </Panel>
      ) : groups.every(g => !g.shown.length) ? (
        <Panel><EmptyState compact icon={Search} title="No items match" description="Try another filter or search." /></Panel>
      ) : view === 'board' ? (
        <NeedsBoard items={boardItems} deptById={deptById} onStatus={setStatus} onOpen={setHistoryItem} />
      ) : (
        <Edit.Provider value={editCtx}>
          <PeopleOptions />
          <div className="space-y-5">
            {groups.filter(g => g.shown.length).map(g => (
              <DeptSection
                key={g.key}
                group={g}
                selected={selected}
                onToggle={(ids, on) => setSelected(s => {
                  const n = new Set(s)
                  ids.forEach(i => (on ? n.add(i) : n.delete(i)))
                  return n
                })}
              />
            ))}
          </div>
        </Edit.Provider>
      )}

      {visibleIds.length > 0 && view === 'table' && (
        <p className="text-xs mt-3" style={{ color: 'var(--adm-silk-faint)' }}>
          Click a name, quantity or person to change it. Every change saves right away.
        </p>
      )}

      <ListFormModal open={editing} list={list} events={events} departments={departments}
        onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load() }} />
      <DepartmentsModal open={deptOpen} departments={departments} onClose={() => setDeptOpen(false)} onChanged={() => { loadDepts(); load() }} />
      <ImportNeedsModal open={importing} list={list} departments={departments} inventory={inventory}
        onClose={() => setImporting(false)} onImported={() => { load(); loadDepts() }} />
      <PrintNeedsModal open={printing} list={list} items={items} departments={departments} onClose={() => setPrinting(false)} />
      <ReceiveModal open={!!receiving} items={receiving || []} list={list} onClose={() => setReceiving(null)}
        onDone={({ done, failed }) => {
          setReceiving(null)
          if (done) addToast(`${done} item${done === 1 ? '' : 's'} added to inventory.`)
          if (failed) addToast(`${failed} could not be added.`, 'error')
          load()
        }} />
      <CheckoutModal open={checkingOut} items={toCheckOut} stock={stock} list={list} onClose={() => setCheckingOut(false)}
        onDone={n => { setCheckingOut(false); addToast(`${n} item${n === 1 ? '' : 's'} checked out. Returns go through Borrowing.`); load() }} />
      <LowStockModal open={lowStock} inventory={inventory} items={items} departments={departments} list={list}
        onClose={() => setLowStock(false)} onAdded={() => { setLowStock(false); load() }} />
      <HistoryDrawer item={historyItem} departments={departments} onClose={() => setHistoryItem(null)} />
      <ShareModal open={sharing} list={list} onClose={() => setSharing(false)} onChanged={token => setList(l => ({ ...l, share_token: token }))} />
      <ConfirmDialog
        open={confirm === 'delete-list'}
        onClose={() => setConfirm(null)}
        onConfirm={deleteList}
        title="Delete this list?"
        message={`${list.title} and its ${items.length} item${items.length === 1 ? '' : 's'} are deleted for good. To keep it out of the way instead, archive it.`}
        confirmLabel="Delete list"
      />
      <ConfirmDialog
        open={confirm === 'delete-items'}
        onClose={() => setConfirm(null)}
        onConfirm={deleteSelected}
        title={`Remove ${selected.size} item${selected.size === 1 ? '' : 's'}?`}
        message="They are taken off this list for good. To keep a record, set them to Dropped instead."
        confirmLabel="Remove"
      />
    </div>
  )
}

// ── Adding items ─────────────────────────────────────────────────────────

const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase()

/**
 * One row to type needs in fast: name, count, unit, department, type.
 * Department and type stay put between adds, so a run of Tech parts is just
 * name, Enter, name, Enter. A name that matches an inventory item is linked
 * to it, and marked "from stock" when enough is on the shelf.
 */
function QuickAdd({ departments, inventory, defaultDept, onAdd }) {
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unit, setUnit] = useState('')
  const [deptId, setDeptId] = useState(defaultDept ? String(defaultDept) : '')
  const [kind, setKind] = useState('equipment')
  const [busy, setBusy] = useState(false)
  const nameRef = useRef(null)

  useEffect(() => { if (defaultDept) setDeptId(String(defaultDept)) }, [defaultDept])

  const match = name.trim() ? inventory.find(i => sameName(i.name, name)) : null
  const qty = Math.max(1, parseInt(quantity, 10) || 1)
  const shelf = match ? onShelf(match) : 0

  const submit = async e => {
    e?.preventDefault()
    if (!name.trim() || busy) return
    setBusy(true)
    const ok = await onAdd({
      name: match ? match.name : name.trim(),
      quantity: qty,
      unit: unit.trim() || null,
      department_id: deptId ? Number(deptId) : null,
      kind: match && match.tracking_mode === 'consumable' ? 'consumable' : kind,
      inventory_item_id: match?.id ?? null,
      source: match && shelf >= qty ? 'stock' : 'buy',
      status: 'needed',
    })
    setBusy(false)
    if (!ok) return
    setName('')
    setQuantity('1')
    nameRef.current?.focus()
  }

  return (
    <Panel as="form" onSubmit={submit} className="p-4">
      <div className="flex flex-wrap items-end gap-2.5">
        <label className="flex-1 min-w-[220px]">
          <span className="adm-label">Add an item</span>
          <input ref={nameRef} className="adm-input" list="needs-inventory" placeholder="HDMI cable, A4 paper, Arduino Uno…"
            value={name} onChange={e => setName(e.target.value)} autoFocus />
          <datalist id="needs-inventory">
            {inventory.map(i => <option key={i.id} value={i.name}>{`${onShelf(i)} on the shelf`}</option>)}
          </datalist>
        </label>
        <label style={{ width: 80 }}>
          <span className="adm-label">Qty</span>
          <input className="adm-input adm-data" type="number" min={1} inputMode="numeric" value={quantity} onChange={e => setQuantity(e.target.value)} />
        </label>
        <label style={{ width: 96 }}>
          <span className="adm-label">Unit</span>
          <input className="adm-input" list="needs-units" placeholder="pcs" value={unit} onChange={e => setUnit(e.target.value)} />
          <datalist id="needs-units">{UNITS.map(u => <option key={u} value={u} />)}</datalist>
        </label>
        <label style={{ width: 150 }}>
          <span className="adm-label">Department</span>
          <select className="adm-input" value={deptId} onChange={e => setDeptId(e.target.value)}>
            <option value="">None</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        <label style={{ width: 140 }}>
          <span className="adm-label">Type</span>
          <select className="adm-input" value={kind} onChange={e => setKind(e.target.value)}>
            {KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
        </label>
        <Button type="submit" variant="primary" icon={Plus} busy={busy} busyLabel="Adding…" disabled={!name.trim()}>Add</Button>
      </div>
      {match && (
        <p className="text-xs mt-2" style={{ color: shelf >= qty ? 'var(--adm-ok)' : 'var(--adm-silk-faint)' }}>
          In inventory as {match.asset_code || match.name}: {shelf} on the shelf.
          {shelf >= qty ? ' It will be marked “From stock”.' : ' Not enough on the shelf, so it will be marked “Buy”.'}
        </p>
      )}
    </Panel>
  )
}

// ── The grouped table ────────────────────────────────────────────────────

function DeptSection({ group, selected, onToggle }) {
  const progress = progressOf(group.all)
  const ids = group.shown.map(i => i.id)
  const allOn = ids.length > 0 && ids.every(i => selected.has(i))
  const shown = [...group.shown].sort((a, b) => kindRank(a) - kindRank(b))

  return (
    <Panel className="overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3" style={{ borderBottom: '1px solid var(--adm-trace)' }}>
        <span className="rounded-full shrink-0" style={{ width: 10, height: 10, background: group.dept?.color || 'var(--adm-silk-faint)' }} />
        <h2 className="text-[15px] font-semibold">{group.dept?.name || 'No department'}</h2>
        <span className="text-xs adm-data ml-auto" style={{ color: 'var(--adm-silk-faint)' }}>
          {progress.ready} / {progress.total} ready
        </span>
      </div>
      <div className="adm-scroll overflow-x-auto">
        <table className="adm-table">
          <thead>
            <tr>
              <th style={{ width: 36 }}>
                <input type="checkbox" className="adm-check" aria-label="Select all in this department" checked={allOn}
                  onChange={e => onToggle(ids, e.target.checked)} />
              </th>
              <th>Item</th>
              <th>Qty</th>
              <th>Type</th>
              <th>Source</th>
              <th>Status</th>
              <th>Who</th>
              <th>Supplier</th>
              <th>Department</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.map(item => (
              <ItemRow key={item.id} item={item} checked={selected.has(item.id)} onCheck={on => onToggle([item.id], on)} />
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

const KIND_RANK = { equipment: 0, consumable: 1, other: 2 }
const kindRank = item => KIND_RANK[item.kind] ?? 3

function ItemRow({ item, checked, onCheck }) {
  const { patch, setStatus, departments, stock, remove, history } = useContext(Edit)
  const linked = item.inventory_item_id ? stock.get(item.inventory_item_id) : null
  const dropped = item.status === 'cancelled'

  return (
    <tr data-selected={checked || undefined} style={{ opacity: dropped ? 0.55 : 1 }}>
      <td><input type="checkbox" className="adm-check" aria-label={`Select ${item.name}`} checked={checked} onChange={e => onCheck(e.target.checked)} /></td>
      <td style={{ minWidth: 220 }}>
        <TextCell value={item.name} label="Name" required strong onSave={name => patch(item, { name })} />
        <TextCell value={item.notes || ''} label="Notes" placeholder="Add a note" small onSave={notes => patch(item, { notes: notes || null })} />
        {linked && (
          <span className="block text-[11px] mt-0.5" style={{ color: onShelf(linked) >= item.quantity ? 'var(--adm-ok)' : 'var(--adm-silk-faint)' }}>
            {onShelf(linked)} on the shelf{linked.asset_code ? ` · ${linked.asset_code}` : ''}
          </span>
        )}
        {item.priority === 'nice' && <span className="block text-[11px] mt-0.5" style={{ color: 'var(--adm-silk-faint)' }}>Nice to have</span>}
        {item.stocked_at && <span className="block text-[11px] mt-0.5" style={{ color: 'var(--adm-ok)' }}>Added to inventory</span>}
        {item.borrow_batch_id && <span className="block text-[11px] mt-0.5" style={{ color: 'var(--adm-signal)' }}>Checked out from stock</span>}
      </td>
      <td style={{ whiteSpace: 'nowrap' }}>
        <span className="inline-flex items-center gap-1">
          <NumberCell value={item.quantity} label={`Quantity of ${item.name}`} onSave={quantity => patch(item, { quantity })} />
          <TextCell value={item.unit || ''} label="Unit" placeholder="unit" small width={56} list="needs-units" onSave={unit => patch(item, { unit: unit || null })} />
        </span>
      </td>
      <td>
        <CellSelect label={`Type of ${item.name}`} value={item.kind} onChange={kind => patch(item, { kind })}>
          {KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
        </CellSelect>
      </td>
      <td>
        <CellSelect label={`Source of ${item.name}`} value={item.source} onChange={source => patch(item, { source })}>
          {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </CellSelect>
      </td>
      <td>
        <span className="flex items-center gap-1.5">
          <span className="rounded-full shrink-0" style={{ width: 8, height: 8, background: STATUS_COLOR[item.status] }} aria-hidden="true" />
          <CellSelect label={`Status of ${item.name}`} value={item.status} onChange={status => setStatus(item, status)}>
            {ITEM_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </CellSelect>
        </span>
      </td>
      <td><AssigneeCell item={item} /></td>
      <td><TextCell value={item.supplier || ''} label="Supplier" placeholder="Where" width={110} onSave={supplier => patch(item, { supplier: supplier || null })} /></td>
      <td>
        <CellSelect label={`Department of ${item.name}`} value={item.department_id ? String(item.department_id) : ''}
          onChange={v => patch(item, { department_id: v ? Number(v) : null })}>
          <option value="">None</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </CellSelect>
      </td>
      <td>
        <span className="flex items-center justify-end gap-0.5">
          <IconButton
            icon={Star}
            size={15}
            label={item.priority === 'must' ? 'Must have. Click for nice to have' : 'Nice to have. Click for must have'}
            onClick={() => patch(item, { priority: item.priority === 'must' ? 'nice' : 'must' })}
            style={{ color: item.priority === 'must' ? 'var(--adm-signal)' : undefined }}
          />
          <IconButton icon={History} size={15} label={`History of ${item.name}`} onClick={() => history(item)} />
          <IconButton icon={Trash2} size={15} danger label={`Remove ${item.name}`} onClick={() => remove(item)} />
        </span>
      </td>
    </tr>
  )
}

// ── Inline cells ─────────────────────────────────────────────────────────

const fold = v => (v || '').trim().toLowerCase()

/**
 * Who is getting it. Typing offers the console's admins and, where the role
 * can see them, the club's members; picking one links the person, so "My
 * items" and email reminders find them. Any other name is kept as text.
 */
function AssigneeCell({ item }) {
  const { patch, people } = useContext(Edit)
  const save = async name => {
    const admin = people.admins.find(a => fold(a.full_name || a.email) === fold(name))
    const member = !admin && people.members.find(m => fold(m.full_name) === fold(name))
    return patch(item, {
      assignee: name || null,
      assignee_user_id: admin ? admin.user_id : null,
      assignee_member_id: member ? member.id : null,
    })
  }
  const linked = item.assignee_user_id || item.assignee_member_id
  return (
    <span className="flex items-center gap-1">
      {linked && <UserRound size={12} style={{ color: 'var(--adm-signal)', flexShrink: 0 }} aria-label="Linked to a person" />}
      <TextCell value={item.assignee || ''} label="Who" placeholder="Someone" width={120} list="needs-people" onSave={save} />
    </span>
  )
}

/** One shared suggestion list for every Who cell. */
function PeopleOptions() {
  const { people } = useContext(Edit)
  return (
    <datalist id="needs-people">
      {people.admins.map(a => <option key={a.user_id} value={a.full_name || a.email}>Admin</option>)}
      {people.members.map(m => <option key={`m${m.id}`} value={m.full_name}>Member</option>)}
    </datalist>
  )
}

function TextCell({ value, label, placeholder, required, strong, small, width, list, onSave }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(value)
  useEffect(() => { if (!editing) setText(value) }, [value, editing])

  const commit = async () => {
    setEditing(false)
    const next = text.trim()
    if (next === value.trim() || (required && !next)) { setText(value); return }
    const ok = await onSave(next)
    if (!ok) setText(value)
  }

  const size = small ? 'text-[12px]' : 'text-[13px]'
  if (editing) {
    return (
      <input
        autoFocus
        className={`adm-input adm-cell-input ${size} ${strong ? 'font-semibold' : ''}`}
        style={{ width: width || '100%', maxWidth: width ? undefined : 280 }}
        aria-label={label}
        list={list}
        value={text}
        placeholder={placeholder}
        onChange={e => setText(e.target.value)}
        onFocus={e => e.target.select()}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); e.target.blur() }
          else if (e.key === 'Escape') { e.preventDefault(); setText(value); setEditing(false) }
        }}
      />
    )
  }
  return (
    <button type="button" className={`adm-cell-text block text-left ${size} ${strong ? 'font-semibold' : ''} adm-truncate`}
      style={{ maxWidth: width || 280, color: value ? (small ? 'var(--adm-silk-dim)' : undefined) : 'var(--adm-silk-faint)' }}
      title={`Click to change ${label.toLowerCase()}`} onClick={() => setEditing(true)}>
      {value || placeholder || '—'}
    </button>
  )
}

function NumberCell({ value, label, onSave }) {
  const [text, setText] = useState(String(value))
  useEffect(() => { setText(String(value)) }, [value])
  const commit = async () => {
    const n = parseInt(text, 10)
    if (!Number.isInteger(n) || n < 1 || n === value) { setText(String(value)); return }
    const ok = await onSave(n)
    if (!ok) setText(String(value))
  }
  return (
    <input
      className="adm-input adm-cell-input adm-data text-[13px]"
      style={{ width: 60 }}
      type="number"
      min={1}
      inputMode="numeric"
      aria-label={label}
      value={text}
      onChange={e => setText(e.target.value)}
      onFocus={e => e.target.select()}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter') { e.preventDefault(); e.target.blur() }
        else if (e.key === 'Escape') { e.preventDefault(); setText(String(value)); e.target.blur() }
      }}
    />
  )
}

function CellSelect({ value, label, onChange, children }) {
  return (
    <select className="adm-input adm-cell-select" aria-label={label} value={value} onChange={e => onChange(e.target.value)}>
      {children}
    </select>
  )
}

const PLACEHOLDER = '__placeholder'

function BulkSelect({ label, onPick, children }) {
  return (
    <select
      className="adm-input adm-cell-select"
      style={{ backgroundColor: 'var(--adm-panel)', color: 'var(--adm-silk)', maxWidth: 170 }}
      aria-label={label}
      value={PLACEHOLDER}
      onChange={e => onPick(e.target.value)}
    >
      <option value={PLACEHOLDER} disabled>{label}</option>
      {children}
    </select>
  )
}
