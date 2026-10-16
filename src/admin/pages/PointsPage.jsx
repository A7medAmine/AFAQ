import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { History, ListPlus, Minus, Plus, RotateCcw, ScanLine, Settings2, Trophy, Users } from 'lucide-react'
import { logActivity, read, run, supabase } from '../lib/db'
import useAdminStore from '../store/adminStore'
import useQueryParam from '../hooks/useQueryParam'
import { formatDate, formatDateTime } from '../lib/format'
import { balances, categoryLabel, formatPoints, pointsTone } from '../lib/points'
import PageHeader, { FilterTabs } from '../components/ui/PageHeader'
import DataTable from '../components/ui/DataTable'
import EmptyState, { ErrorState } from '../components/ui/EmptyState'
import Button from '../components/ui/Button'
import ExportMenu from '../components/ui/ExportMenu'
import Badge from '../components/ui/Badge'
import Panel from '../components/ui/Panel'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { CheckField, SelectField, TextField } from '../components/ui/Field'
import PointsModal from '../components/hr/PointsModal'
import PointsHistoryModal from '../components/hr/PointsHistoryModal'
import PresetsModal from '../components/hr/PresetsModal'

const VIEWS = [{ value: 'ranking', label: 'Ranking' }, { value: 'history', label: 'History' }]

/**
 * Member points: who has how many, every change behind them, and the rules
 * that give points automatically. Only HR and super admins reach this screen;
 * department heads see their own members' points on their dashboard.
 */
export default function PointsPage() {
  const userId = useAdminStore(s => s.adminProfile?.user_id)
  const [members, setMembers] = useState([])
  const [departments, setDepartments] = useState([])
  const [groups, setGroups] = useState([])
  const [presets, setPresets] = useState([])
  const [entries, setEntries] = useState([])
  const [admins, setAdmins] = useState({})
  const [state, setState] = useState({ loading: true, error: null })
  const [view, setView] = useQueryParam('view', 'ranking')
  const [department, setDepartment] = useQueryParam('department', '')
  const [giving, setGiving] = useState(null) // { members, clear? }
  const [resetting, setResetting] = useState(null) // { members, clear? }
  const [historyOf, setHistoryOf] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [presetsOpen, setPresetsOpen] = useState(false)
  const [groupOpen, setGroupOpen] = useState(false)

  const load = useCallback(async () => {
    setState(s => ({ ...s, error: null }))
    const [memberRes, deptRes, entryRes, adminRes, groupRes, presetRes] = await Promise.all([
      read(supabase.from('members').select('id, full_name, email, member_code, status, member_departments(department_id), member_group_members(group_id)').order('full_name')),
      read(supabase.from('departments').select('id, name, color').order('sort_order')),
      read(supabase.from('point_entries').select('*').order('created_at', { ascending: false })),
      read(supabase.from('admin_users').select('user_id, full_name, email')),
      read(supabase.from('member_groups').select('id, name').order('name')),
      read(supabase.from('point_presets').select('*').order('sort_order')),
    ])
    const failed = [memberRes, deptRes, entryRes].find(r => !r.ok)
    if (failed) { setState({ loading: false, error: failed.message }); return }
    setMembers(memberRes.data || [])
    setDepartments(deptRes.data || [])
    setEntries(entryRes.data || [])
    setAdmins(Object.fromEntries((adminRes.data || []).map(a => [a.user_id, a.full_name || a.email])))
    setGroups(groupRes.data || [])
    setPresets(presetRes.data || [])
    setState({ loading: false, error: null })
  }, [])

  useEffect(() => { load() }, [load])

  const totals = useMemo(() => balances(entries), [entries])
  const lastChange = useMemo(() => {
    const last = {}
    entries.forEach(e => { if (!last[e.member_id]) last[e.member_id] = e.created_at })
    return last
  }, [entries])
  const deptById = useMemo(() => Object.fromEntries(departments.map(d => [d.id, d])), [departments])
  const memberById = useMemo(() => Object.fromEntries(members.map(m => [m.id, m])), [members])

  const inDepartment = useCallback(m => !department || (m.member_departments || []).some(d => String(d.department_id) === department), [department])

  const ranking = useMemo(() => members
    .filter(inDepartment)
    .map(m => ({ ...m, points: totals[m.id] || 0, last_change: lastChange[m.id] || null }))
    .sort((a, b) => b.points - a.points || a.full_name.localeCompare(b.full_name))
    .map((m, i) => ({ ...m, rank: i + 1 })), [members, totals, lastChange, inDepartment])

  const history = useMemo(() => entries
    .filter(e => !department || inDepartment(memberById[e.member_id] || {}))
    .map(e => ({ ...e, member_name: memberById[e.member_id]?.full_name || '—', by: e.awarded_by ? admins[e.awarded_by] || 'An admin' : 'Automatic' })),
  [entries, department, inDepartment, memberById, admins])

  const reset = async () => {
    const targets = resetting.members.filter(m => (totals[m.id] || 0) !== 0)
    if (!targets.length) { setResetting(null); return }
    const { ok } = await run(
      supabase.from('point_entries').insert(targets.map(m => ({
        member_id: m.id, points: -totals[m.id], category: 'reset', reason: 'Points reset', awarded_by: userId,
      }))),
      { success: `Points reset for ${targets.length} member${targets.length === 1 ? '' : 's'}.`, failure: 'The points were not reset.' }
    )
    if (!ok) return
    logActivity('updated', 'point_entries', null, { reset: targets.length })
    resetting.clear?.()
    setResetting(null)
    load()
  }

  const departmentBadges = m => (m.member_departments || []).map(d => deptById[d.department_id]).filter(Boolean)

  const rankingColumns = useMemo(() => [
    { header: '#', accessorKey: 'rank', cell: ({ row }) => <span className="adm-data text-[12px]">{row.original.rank}</span> },
    {
      header: 'Member',
      accessorKey: 'full_name',
      cell: ({ row }) => (
        <span className="min-w-0 block">
          <span className="block text-sm font-semibold adm-truncate" style={{ maxWidth: 220 }}>{row.original.full_name}</span>
          <span className="adm-data block text-[11px]" style={{ color: 'var(--adm-silk-faint)' }}>{row.original.member_code || row.original.email}</span>
        </span>
      ),
    },
    {
      header: 'Departments',
      id: 'departments',
      accessorFn: m => departmentBadges(m).map(d => d.name).join(', '),
      cell: ({ row }) => {
        const list = departmentBadges(row.original)
        if (!list.length) return <span className="text-[13px]" style={{ color: 'var(--adm-silk-faint)' }}>—</span>
        return <span className="flex flex-wrap gap-1">{list.map(d => <Badge key={d.id}>{d.name}</Badge>)}</span>
      },
    },
    {
      header: 'Points',
      accessorKey: 'points',
      cell: ({ row }) => <span className="adm-data text-sm font-semibold">{row.original.points}</span>,
    },
    {
      header: 'Last change',
      accessorKey: 'last_change',
      cell: ({ row }) => <span className="adm-data text-[12px]">{row.original.last_change ? formatDate(row.original.last_change) : '—'}</span>,
    },
  ], [deptById]) // eslint-disable-line react-hooks/exhaustive-deps

  const historyColumns = useMemo(() => [
    { header: 'When', accessorKey: 'created_at', cell: ({ row }) => <span className="adm-data text-[12px]">{formatDateTime(row.original.created_at)}</span> },
    { header: 'Member', accessorKey: 'member_name', cell: ({ row }) => <span className="text-sm font-semibold">{row.original.member_name}</span> },
    { header: 'Points', accessorKey: 'points', cell: ({ row }) => <Badge tone={pointsTone(row.original.points)}>{formatPoints(row.original.points)}</Badge> },
    { header: 'Category', accessorKey: 'category', cell: ({ row }) => <span className="text-[13px]">{categoryLabel(row.original.category)}</span> },
    { header: 'Reason', accessorKey: 'reason', cell: ({ row }) => <span className="text-[13px] adm-truncate block" style={{ maxWidth: 280 }}>{row.original.reason}</span> },
    { header: 'By', accessorKey: 'by', cell: ({ row }) => <span className="text-[13px]" style={{ color: 'var(--adm-silk-dim)' }}>{row.original.by}</span> },
  ], [])

  const departmentFilter = departments.length > 0 && (
    <select className="adm-input" style={{ width: 'auto', height: 40 }} value={department}
      onChange={e => setDepartment(e.target.value)} aria-label="Department filter">
      <option value="">All departments</option>
      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
    </select>
  )

  const viewTabs = <FilterTabs options={VIEWS} value={view} onChange={setView} label="View" />

  return (
    <div>
      <PageHeader
        eyebrow="People"
        title="Points"
        description="Points members earn for taking part. Tasks marked done add points on their own; everything else is given here."
        actions={
          <>
            {view === 'ranking' ? (
              <ExportMenu
                filename={`points-${new Date().toISOString().slice(0, 10)}`}
                title="Points"
                subtitle={formatDateTime(new Date())}
                headers={['Rank', 'Name', 'Member no.', 'Departments', 'Points']}
                rows={ranking.map(m => [m.rank, m.full_name, m.member_code, departmentBadges(m).map(d => d.name).join(', '), m.points])}
                disabled={!ranking.length}
              />
            ) : (
              <ExportMenu
                filename={`points-history-${new Date().toISOString().slice(0, 10)}`}
                title="Points history"
                subtitle={formatDateTime(new Date())}
                headers={['When', 'Member', 'Points', 'Category', 'Reason', 'By']}
                rows={history.map(e => [formatDateTime(e.created_at), e.member_name, e.points, categoryLabel(e.category), e.reason, e.by])}
                disabled={!history.length}
              />
            )}
            <Button icon={Settings2} onClick={() => setSettingsOpen(true)}>Automatic points</Button>
            <Button icon={ListPlus} onClick={() => setPresetsOpen(true)}>Presets</Button>
            <Button icon={Users} onClick={() => setGroupOpen(true)}>Give to a group</Button>
            <Link to="/admin/points/quick" className="adm-btn adm-btn-primary"><ScanLine size={15} /> Quick give</Link>
            <Button icon={RotateCcw} disabled={!ranking.some(m => m.points !== 0)} onClick={() => setResetting({ members: ranking })}>
              Reset {department ? 'department' : 'all'}
            </Button>
          </>
        }
      />

      {state.error ? (
        <Panel><ErrorState message={state.error} onRetry={load} /></Panel>
      ) : view === 'history' ? (
        <DataTable
          columns={historyColumns}
          data={history}
          loading={state.loading}
          getRowId={row => String(row.id)}
          searchPlaceholder="Search by member or reason…"
          toolbar={<div className="flex flex-wrap items-center gap-2">{viewTabs}{departmentFilter}</div>}
          emptyState={<EmptyState compact icon={History} title="No points given yet" description="Give points from the ranking, or mark a task done." />}
        />
      ) : (
        <DataTable
          columns={rankingColumns}
          data={ranking}
          loading={state.loading}
          getRowId={row => String(row.id)}
          onRowClick={row => setHistoryOf(row)}
          enableSelection
          searchPlaceholder="Search members…"
          toolbar={<div className="flex flex-wrap items-center gap-2">{viewTabs}{departmentFilter}</div>}
          bulkActions={(selected, clear) => (
            <>
              <Button size="sm" variant="primary" icon={Plus} onClick={() => setGiving({ members: selected, clear })}>Give points</Button>
              <Button size="sm" icon={Minus} onClick={() => setGiving({ members: selected, clear, take: true })}>Take away</Button>
              <Button size="sm" icon={RotateCcw} onClick={() => setResetting({ members: selected, clear })}>Reset</Button>
            </>
          )}
          emptyState={<EmptyState compact icon={Trophy} title="Nobody here" description="No members in this department yet." />}
        />
      )}

      <PointsModal
        open={!!giving}
        members={giving?.members || []}
        take={!!giving?.take}
        onClose={() => setGiving(null)}
        onSaved={() => { giving?.clear?.(); load() }}
      />

      <PointsHistoryModal
        member={historyOf}
        entries={historyOf ? entries.filter(e => e.member_id === historyOf.id) : []}
        admins={admins}
        onClose={() => setHistoryOf(null)}
      />

      <ConfirmDialog
        open={!!resetting}
        onClose={() => setResetting(null)}
        onConfirm={reset}
        title="Reset these points to zero?"
        message={resetting
          ? `${resetting.members.filter(m => (totals[m.id] || 0) !== 0).length} member(s) go back to 0. Their history stays, with a reset line added.`
          : ''}
        confirmLabel="Reset points"
      />

      <AutoPointsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <PresetsModal open={presetsOpen} presets={presets} onClose={() => setPresetsOpen(false)} onChanged={load} />

      <GroupPickModal
        open={groupOpen}
        members={members}
        departments={departments}
        groups={groups}
        onClose={() => setGroupOpen(false)}
        onPick={picked => { setGroupOpen(false); setGiving({ members: picked }) }}
      />
    </div>
  )
}

/** Everyone in a department or member group, for giving them all the same points. */
function GroupPickModal({ open, members, departments, groups, onClose, onPick }) {
  const [choice, setChoice] = useState('')
  const [activeOnly, setActiveOnly] = useState(true)

  useEffect(() => { if (open) setChoice(departments[0] ? `d${departments[0].id}` : groups[0] ? `g${groups[0].id}` : '') }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const picked = useMemo(() => {
    const id = Number(choice.slice(1))
    return members.filter(m => (!activeOnly || (m.status || 'active') === 'active') && (choice[0] === 'd'
      ? (m.member_departments || []).some(d => d.department_id === id)
      : (m.member_group_members || []).some(g => g.group_id === id)))
  }, [choice, activeOnly, members])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Give to a group"
      description="Everyone in a department or a member group gets the same points, in one go."
      footer={
        <>
          <Button onClick={onClose} data-dialog-dismiss="true">Cancel</Button>
          <Button variant="primary" disabled={!picked.length} onClick={() => onPick(picked)}>
            Next: {picked.length} member{picked.length === 1 ? '' : 's'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <SelectField label="Who" value={choice} onChange={e => setChoice(e.target.value)}>
          {departments.length > 0 && (
            <optgroup label="Departments">
              {departments.map(d => <option key={d.id} value={`d${d.id}`}>{d.name}</option>)}
            </optgroup>
          )}
          {groups.length > 0 && (
            <optgroup label="Member groups">
              {groups.map(g => <option key={g.id} value={`g${g.id}`}>{g.name}</option>)}
            </optgroup>
          )}
        </SelectField>
        <CheckField label="Active members only" description="Leave out alumni, inactive and suspended members."
          checked={activeOnly} onChange={setActiveOnly} />
      </div>
    </Modal>
  )
}

function AutoPointsModal({ open, onClose }) {
  const [form, setForm] = useState(null)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setError(null)
    read(supabase.from('point_settings').select('*').eq('id', 1).maybeSingle()).then(({ data }) => {
      setForm({ auto_enabled: data?.auto_enabled ?? true, task_done_points: String(data?.task_done_points ?? 10) })
    })
  }, [open])

  const save = async () => {
    const points = Math.round(Number(form.task_done_points))
    if (!Number.isFinite(points) || points < 0) { setError('Enter zero or a whole number above it.'); return }
    setSaving(true)
    const { ok } = await run(
      supabase.from('point_settings').update({ auto_enabled: form.auto_enabled, task_done_points: points, updated_at: new Date().toISOString() }).eq('id', 1),
      { success: 'Automatic points saved.', failure: 'The settings were not saved.' }
    )
    setSaving(false)
    if (!ok) return
    logActivity('updated', 'point_settings', 1, { auto_enabled: form.auto_enabled, task_done_points: points })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Automatic points"
      description="Points the console gives on its own. Changes apply from now on; points already given stay."
      footer={
        <>
          <Button onClick={onClose} data-dialog-dismiss="true">Cancel</Button>
          <Button variant="primary" onClick={save} busy={saving} busyLabel="Saving…" disabled={!form}>Save</Button>
        </>
      }
    >
      {form && (
        <div className="space-y-4">
          <CheckField label="Give points automatically" checked={form.auto_enabled}
            onChange={on => setForm(f => ({ ...f, auto_enabled: on }))} />
          <TextField label="Points for a task marked done" type="number" min="0" step="1" error={error}
            hint="Given once per task, to the member it is assigned to."
            value={form.task_done_points} disabled={!form.auto_enabled}
            onChange={e => { setForm(f => ({ ...f, task_done_points: e.target.value })); setError(null) }} />
        </div>
      )}
    </Modal>
  )
}
