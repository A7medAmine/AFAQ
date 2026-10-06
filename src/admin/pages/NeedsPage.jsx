import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, ClipboardList, Layers, Plus } from 'lucide-react'
import { read, supabase } from '../lib/db'
import useQueryParam from '../hooks/useQueryParam'
import { formatDate } from '../lib/format'
import { LIST_STATUSES, isLate, listContext, loadDepartments, progressOf, scopeLabel } from '../lib/needs'
import PageHeader, { FilterTabs } from '../components/ui/PageHeader'
import EmptyState, { ErrorState } from '../components/ui/EmptyState'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Panel from '../components/ui/Panel'
import Skeleton from '../components/ui/Skeleton'
import DepartmentsModal from '../components/needs/DepartmentsModal'
import ListFormModal from '../components/needs/ListFormModal'

/**
 * Logistics' lists of what has to be gathered — for an event, for one
 * department, or anything else. Each card shows how much of it is ready.
 */
export default function NeedsPage() {
  const navigate = useNavigate()
  const [lists, setLists] = useState([])
  const [events, setEvents] = useState([])
  const [departments, setDepartments] = useState([])
  const [state, setState] = useState({ loading: true, error: null })
  const [status, setStatus] = useQueryParam('status', 'open')
  const [creating, setCreating] = useState(false)
  const [deptOpen, setDeptOpen] = useState(false)

  const loadDepts = useCallback(async () => {
    const { ok, data } = await loadDepartments()
    if (ok) setDepartments(data || [])
  }, [])

  const load = useCallback(async () => {
    setState(s => ({ ...s, error: null }))
    const [listRes, eventRes] = await Promise.all([
      read(supabase.from('need_lists')
        .select('*, event:events(id, title_en, date), department:departments(id, name, color), items:need_items(id, status, department_id)')
        .order('created_at', { ascending: false })),
      read(supabase.from('events').select('id, title_en, date').order('date', { ascending: false })),
    ])
    if (!listRes.ok) { setState({ loading: false, error: listRes.message }); return }
    setLists(listRes.data || [])
    setEvents(eventRes.data || [])
    setState({ loading: false, error: null })
  }, [])

  useEffect(() => { load(); loadDepts() }, [load, loadDepts])

  const shown = useMemo(() => (status === 'all' ? lists : lists.filter(l => l.status === status)), [lists, status])
  const filterOptions = [
    ...LIST_STATUSES.map(s => ({ ...s, count: lists.filter(l => l.status === s.value).length })),
    { value: 'all', label: 'All', count: lists.length },
  ]

  return (
    <div>
      <PageHeader
        eyebrow="Resources"
        title="Needs lists"
        description="What each event or department needs, who is getting it, and what is ready. Print any list in English, French or Arabic."
        actions={
          <>
            <Button icon={Layers} onClick={() => setDeptOpen(true)}>Departments</Button>
            <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>New list</Button>
          </>
        }
      />

      <div className="mb-5">
        <FilterTabs options={filterOptions} value={status} onChange={setStatus} label="List status" />
      </div>

      {state.error ? (
        <Panel><ErrorState message={state.error} onRetry={load} /></Panel>
      ) : state.loading ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[0, 1, 2].map(i => <Panel key={i} className="p-5"><Skeleton style={{ height: 18, width: '60%' }} /><Skeleton style={{ height: 12, width: '40%', marginTop: 12 }} /></Panel>)}
        </div>
      ) : shown.length === 0 ? (
        <Panel>
          <EmptyState
            icon={ClipboardList}
            title={lists.length ? 'No lists here' : 'No needs lists yet'}
            description={lists.length ? 'Try another filter.' : 'Start one for an event, a department, or anything else logistics has to gather.'}
            action={!lists.length && <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>New list</Button>}
          />
        </Panel>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {shown.map(list => <ListCard key={list.id} list={list} departments={departments} onOpen={() => navigate(`/admin/needs/${list.id}`)} />)}
        </div>
      )}

      <ListFormModal
        open={creating}
        list={null}
        events={events}
        departments={departments}
        onClose={() => setCreating(false)}
        onSaved={id => { setCreating(false); navigate(`/admin/needs/${id}`) }}
      />
      <DepartmentsModal open={deptOpen} departments={departments} onClose={() => setDeptOpen(false)} onChanged={() => { loadDepts(); load() }} />
    </div>
  )
}

function ListCard({ list, departments, onOpen }) {
  const items = list.items || []
  const progress = progressOf(items)
  const late = isLate(list)
  const deptIds = [...new Set(items.filter(i => i.status !== 'cancelled').map(i => i.department_id).filter(Boolean))]
  const depts = departments.filter(d => deptIds.includes(d.id))

  return (
    <Panel as="button" type="button" onClick={onOpen} className="p-5 text-left w-full transition-colors hover:brightness-[1.02]" style={{ cursor: 'pointer' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="adm-eyebrow mb-1">{scopeLabel(list.scope)}</p>
          <p className="text-[15px] font-semibold adm-truncate">{list.title}</p>
          <p className="text-xs mt-0.5 adm-truncate" style={{ color: 'var(--adm-silk-dim)' }}>{listContext(list)}</p>
        </div>
        {list.status !== 'open' && <Badge tone={list.status === 'done' ? 'ok' : undefined}>{list.status === 'done' ? 'Done' : 'Archived'}</Badge>}
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs mb-1.5" style={{ color: 'var(--adm-silk-faint)' }}>
          <span>{progress.total ? `${progress.ready} of ${progress.total} ready` : 'No items yet'}</span>
          <span className="adm-data">{progress.pct}%</span>
        </div>
        <div className="rounded-full overflow-hidden" style={{ height: 6, background: 'var(--adm-board-sunk)' }}>
          <div style={{ width: `${progress.pct}%`, height: '100%', background: progress.pct === 100 ? 'var(--adm-ok)' : 'var(--adm-signal)' }} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mt-4">
        {depts.map(d => (
          <span key={d.id} className="inline-flex items-center gap-1 text-[11.5px] px-1.5 py-0.5 rounded-md"
            style={{ background: 'var(--adm-panel-raise)', color: 'var(--adm-silk-dim)' }}>
            <span className="rounded-full" style={{ width: 7, height: 7, background: d.color || 'var(--adm-silk-faint)' }} />
            {d.name}
          </span>
        ))}
        {list.due_date && (
          <span className="inline-flex items-center gap-1 text-[11.5px] ml-auto" style={{ color: late ? 'var(--adm-fault)' : 'var(--adm-silk-faint)' }}>
            <CalendarDays size={12} /> {late ? 'Late · ' : ''}{formatDate(list.due_date)}
          </span>
        )}
      </div>
    </Panel>
  )
}
