import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, ListChecks, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { logActivity, read, run, supabase } from '../lib/db'
import useQueryParam from '../hooks/useQueryParam'
import { formatDate, formatDateTime } from '../lib/format'
import { TASK_PRIORITIES, TASK_STATUSES, isOpenTask, isOverdue } from '../lib/hr'
import PageHeader, { FilterTabs } from '../components/ui/PageHeader'
import DataTable from '../components/ui/DataTable'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import EmptyState, { ErrorState } from '../components/ui/EmptyState'
import Button, { IconButton } from '../components/ui/Button'
import ExportMenu from '../components/ui/ExportMenu'
import Badge, { StatusBadge } from '../components/ui/Badge'
import Panel from '../components/ui/Panel'
import TaskModal from '../components/hr/TaskModal'

const FILTERS = [
  { value: 'open', label: 'Open' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'done', label: 'Done' },
  { value: 'all', label: 'All' },
]

const matches = (task, filter) => {
  if (filter === 'open') return isOpenTask(task)
  if (filter === 'overdue') return isOverdue(task)
  if (filter === 'done') return task.status === 'done'
  return true
}

const PRIORITY_TONE = { high: 'fault', normal: 'neutral', low: 'neutral' }
const PRIORITY_ORDER = { high: 0, normal: 1, low: 2 }

/**
 * Who is doing what, by when. Filters live in the URL so a member's detail
 * view and a project row can link straight to "their" tasks.
 */
export default function TasksPage() {
  const [rows, setRows] = useState([])
  const [members, setMembers] = useState([])
  const [projects, setProjects] = useState([])
  const [state, setState] = useState({ loading: true, error: null })

  const [filter, setFilter] = useQueryParam('status', 'open')
  const [assignee, setAssignee] = useQueryParam('assignee', '')
  const [project, setProject] = useQueryParam('project', '')
  const [search] = useQueryParam('q')

  const [editor, setEditor] = useState(null) // { task } | { task: null }
  const [pendingDelete, setPendingDelete] = useState(null)

  const load = useCallback(async () => {
    setState(s => ({ ...s, error: null }))
    const [tasks, roster, projectList] = await Promise.all([
      read(supabase.from('member_tasks')
        .select('*, assignee:members(id, full_name, member_code), project:projects(id, title_en)')
        .order('created_at', { ascending: false })),
      read(supabase.from('members').select('id, full_name').eq('status', 'active').order('full_name')),
      read(supabase.from('projects').select('id, title_en').order('title_en')),
    ])
    if (!tasks.ok) { setState({ loading: false, error: tasks.message }); return }
    setRows(tasks.data || [])
    setMembers(roster.data || [])
    setProjects(projectList.data || [])
    setState({ loading: false, error: null })
  }, [])

  useEffect(() => { load() }, [load])

  const scoped = useMemo(() => rows.filter(t =>
    (!assignee || String(t.assignee_id) === assignee) && (!project || String(t.project_id) === project)
  ), [rows, assignee, project])

  const filtered = useMemo(() => scoped
    .filter(t => matches(t, filter))
    .sort((a, b) =>
      (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1) ||
      (a.due_date || '9999').localeCompare(b.due_date || '9999')
    ), [scoped, filter])

  const filterOptions = FILTERS.map(f => ({ ...f, count: scoped.filter(t => matches(t, f.value)).length }))

  // Former members can still own old tasks; keep them in the filter list.
  const assigneeOptions = useMemo(() => {
    const byId = new Map(members.map(m => [m.id, m]))
    rows.forEach(t => t.assignee && !byId.has(t.assignee.id) && byId.set(t.assignee.id, t.assignee))
    return [...byId.values()].sort((a, b) => a.full_name.localeCompare(b.full_name))
  }, [members, rows])

  const setStatus = async (tasks, status, clear) => {
    const ids = tasks.map(t => t.id)
    const { ok } = await run(
      supabase.from('member_tasks').update({
        status,
        completed_at: status === 'done' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }).in('id', ids),
      {
        success: ids.length === 1 ? `Marked ${TASK_STATUSES.find(s => s.value === status)?.label.toLowerCase()}.` : `${ids.length} tasks updated.`,
        failure: 'The task did not update.',
      }
    )
    if (!ok) return
    tasks.forEach(t => logActivity('updated', 'member_tasks', t.id, { name: t.title, status }))
    clear?.()
    load()
  }

  const deleteTasks = async () => {
    const list = pendingDelete
    const { ok } = await run(
      supabase.from('member_tasks').delete().in('id', list.map(t => t.id)),
      { success: list.length === 1 ? 'Task deleted.' : `${list.length} tasks deleted.`, failure: 'The task was not deleted.' }
    )
    if (!ok) return
    list.forEach(t => logActivity('deleted', 'member_tasks', t.id, { name: t.title }))
    setPendingDelete(null)
    load()
  }

  const exportHeaders = ['Task', 'Assigned to', 'Project', 'Priority', 'Due', 'Status', 'Completed']
  const exportRows = filtered.map(t => [
    t.title, t.assignee?.full_name, t.project?.title_en, t.priority,
    t.due_date ? formatDate(t.due_date) : '', t.status, t.completed_at ? formatDate(t.completed_at) : '',
  ])

  const columns = useMemo(() => [
    {
      header: 'Task',
      accessorKey: 'title',
      cell: ({ row }) => (
        <span className="block min-w-0">
          <span className="block text-sm font-semibold adm-truncate" style={{
            maxWidth: 320,
            textDecoration: row.original.status === 'done' ? 'line-through' : 'none',
            opacity: row.original.status === 'cancelled' ? 0.6 : 1,
          }}>
            {row.original.title}
          </span>
          {row.original.description && (
            <span className="block text-[12px] adm-truncate" style={{ color: 'var(--adm-silk-faint)', maxWidth: 320 }}>
              {row.original.description}
            </span>
          )}
        </span>
      ),
    },
    {
      header: 'Assigned to',
      id: 'assignee',
      accessorFn: t => t.assignee?.full_name || '',
      cell: ({ row }) => (
        <span className="text-[13px]" style={{ color: row.original.assignee ? 'var(--adm-silk)' : 'var(--adm-silk-faint)' }}>
          {row.original.assignee?.full_name || 'Unassigned'}
        </span>
      ),
    },
    {
      header: 'Project',
      id: 'project',
      accessorFn: t => t.project?.title_en || '',
      cell: ({ row }) => (
        <span className="text-[13px]" style={{ color: 'var(--adm-silk-dim)' }}>{row.original.project?.title_en || '—'}</span>
      ),
    },
    {
      header: 'Priority',
      accessorKey: 'priority',
      cell: ({ row }) => (
        <Badge tone={PRIORITY_TONE[row.original.priority] || 'neutral'}>
          {TASK_PRIORITIES.find(p => p.value === row.original.priority)?.label || row.original.priority}
        </Badge>
      ),
    },
    {
      header: 'Due',
      accessorKey: 'due_date',
      cell: ({ row }) => (
        <span className="adm-data text-[12px]" style={{ color: isOverdue(row.original) ? 'var(--adm-fault)' : undefined }}>
          {row.original.due_date ? formatDate(row.original.due_date) : '—'}
        </span>
      ),
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ row }) => isOverdue(row.original) ? <StatusBadge status="overdue" /> : <StatusBadge status={row.original.status} />,
    },
    {
      header: '',
      id: 'actions',
      cell: ({ row }) => {
        const t = row.original
        return (
          <div className="flex items-center justify-end gap-0.5" onClick={e => e.stopPropagation()}>
            {isOpenTask(t)
              ? <IconButton icon={Check} label="Mark done" onClick={() => setStatus([t], 'done')} />
              : <IconButton icon={RotateCcw} label="Reopen" onClick={() => setStatus([t], 'todo')} />}
            <IconButton icon={Pencil} label="Edit" onClick={() => setEditor({ task: t })} />
            <IconButton icon={Trash2} label="Delete" danger onClick={() => setPendingDelete([t])} />
          </div>
        )
      },
    },
  ], []) // eslint-disable-line react-hooks/exhaustive-deps

  const scopeLabel = [
    assignee && assigneeOptions.find(m => String(m.id) === assignee)?.full_name,
    project && projects.find(p => String(p.id) === project)?.title_en,
  ].filter(Boolean).join(' · ')

  return (
    <div>
      <PageHeader
        eyebrow="Operate"
        title="Tasks"
        description="Responsibilities handed to members, on their own or as part of a project."
        actions={
          <>
            <ExportMenu
              filename={`tasks-${filter}-${new Date().toISOString().slice(0, 10)}`}
              title="Tasks"
              subtitle={`${scopeLabel ? `${scopeLabel} · ` : ''}${formatDateTime(new Date())}`}
              headers={exportHeaders}
              rows={exportRows}
              statusColumnIndex={5}
              disabled={!filtered.length}
            />
            <Button variant="primary" icon={Plus} onClick={() => setEditor({ task: null })}>New task</Button>
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
          onRowClick={t => setEditor({ task: t })}
          enableSelection
          searchPlaceholder="Search tasks, people, projects…"
          rowAttributes={t => (isOverdue(t) ? { 'data-tone': 'fault' } : undefined)}
          toolbar={
            <div className="flex flex-wrap items-center gap-2">
              <FilterTabs options={filterOptions} value={filter} onChange={setFilter} label="Task filter" />
              <select className="adm-input" style={{ width: 'auto', height: 40 }} value={assignee}
                onChange={e => setAssignee(e.target.value)} aria-label="Assignee filter">
                <option value="">Everyone</option>
                {assigneeOptions.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
              </select>
              <select className="adm-input" style={{ width: 'auto', height: 40 }} value={project}
                onChange={e => setProject(e.target.value)} aria-label="Project filter">
                <option value="">All projects</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.title_en}</option>)}
              </select>
              {project && (
                <Link to="/admin/projects" className="text-xs font-semibold" style={{ color: 'var(--adm-signal)' }}>
                  Back to projects
                </Link>
              )}
            </div>
          }
          bulkActions={(selected, clear) => (
            <>
              <Button size="sm" variant="primary" icon={Check} onClick={() => setStatus(selected, 'done', clear)}>
                Mark done
              </Button>
              <Button size="sm" icon={RotateCcw} onClick={() => setStatus(selected, 'todo', clear)}>Reopen</Button>
              <Button size="sm" icon={Trash2} onClick={() => { setPendingDelete(selected); clear() }}>Delete</Button>
            </>
          )}
          emptyState={
            rows.length === 0 ? (
              <EmptyState
                icon={ListChecks}
                title="No tasks yet"
                description="Hand out responsibilities — workshop prep, a project module, the event poster — and track them here."
                action={<Button variant="primary" icon={Plus} onClick={() => setEditor({ task: null })}>New task</Button>}
              />
            ) : (
              <EmptyState compact icon={ListChecks} title="Nothing in this view" description="Try another filter." />
            )
          }
        />
      )}

      <TaskModal
        open={!!editor}
        task={editor?.task || null}
        defaults={{
          assignee_id: assignee ? Number(assignee) : null,
          project_id: project ? Number(project) : null,
        }}
        members={assigneeOptions}
        projects={projects}
        onClose={() => setEditor(null)}
        onSaved={load}
      />

      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={deleteTasks}
        title={pendingDelete?.length === 1 ? `Delete “${pendingDelete[0].title}”?` : `Delete ${pendingDelete?.length || 0} tasks?`}
        message="Deleted tasks are gone for good. To keep a record, mark them done or cancelled instead."
        confirmLabel="Delete"
      />
    </div>
  )
}
