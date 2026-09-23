import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CalendarX, Crown, Eye, FileSpreadsheet, Shield, IdCard, ListChecks, Loader2, Pencil, Plus, Printer, Trash2, UserCheck, UserRoundPlus, Upload, Users, X,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { logActivity, run, read, supabase, uploadFile } from '../lib/db'
import useAdminStore from '../store/adminStore'
import useQueryParam from '../hooks/useQueryParam'
import { formatDate, formatDateTime, toDateInput } from '../lib/format'
import {
  GENDERS, MEMBER_STATUSES, isCurrentTerm, isOpenTask, isOverdue, positionLabel, roleOptions, sortPositions,
} from '../lib/hr'
import { hasPermission } from '../lib/permissions'
import PageHeader, { FilterTabs } from '../components/ui/PageHeader'
import DataTable from '../components/ui/DataTable'
import Drawer, { DetailRow, TagList } from '../components/ui/Drawer'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import EmptyState, { ErrorState } from '../components/ui/EmptyState'
import Button, { IconButton } from '../components/ui/Button'
import ExportMenu from '../components/ui/ExportMenu'
import Badge, { StatusBadge } from '../components/ui/Badge'
import Panel from '../components/ui/Panel'
import MemberFormModal from '../components/hr/MemberFormModal'
import PositionModal from '../components/hr/PositionModal'
import TaskModal from '../components/hr/TaskModal'
import ImportMembersModal from '../components/hr/ImportMembersModal'
import RolesModal from '../components/hr/RolesModal'
import GroupsModal from '../components/hr/GroupsModal'
import AddToGroupModal from '../components/hr/AddToGroupModal'

const STATUS_FILTERS = [{ value: 'all', label: 'All' }, ...MEMBER_STATUSES]

const MEMBER_SELECT = '*, member_positions(id, member_id, title, team, term_start, term_end, notes), member_group_members(group_id)'

export default function MembersPage() {
  const navigate = useNavigate()
  const role = useAdminStore(s => s.adminProfile?.role?.name)
  const canTasks = hasPermission(role, 'tasks.manage')

  const [rows, setRows] = useState([])
  const [customRoles, setCustomRoles] = useState([])
  const [groups, setGroups] = useState([])
  const [state, setState] = useState({ loading: true, error: null })
  const [search] = useQueryParam('q')
  const [status, setStatus] = useQueryParam('status', 'all')
  const [team, setTeam] = useQueryParam('team', '')
  const [roleFilter, setRoleFilter] = useQueryParam('role', '')
  const [groupFilter, setGroupFilter] = useQueryParam('group', '')

  const [detailId, setDetailId] = useState(null)
  const [form, setForm] = useState(null) // { member } | { member: null } for add
  const [positionForm, setPositionForm] = useState(null) // { position, memberId }
  const [pendingDelete, setPendingDelete] = useState(null)
  const [bulkStatus, setBulkStatus] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [rolesOpen, setRolesOpen] = useState(false)
  const [groupsOpen, setGroupsOpen] = useState(false)
  const [grouping, setGrouping] = useState(null) // { members, clear? }

  const load = useCallback(async () => {
    setState(s => ({ ...s, error: null }))
    const [{ ok, data, message }, roles, groupRows] = await Promise.all([
      read(supabase.from('members').select(MEMBER_SELECT).order('created_at', { ascending: false })),
      read(supabase.from('member_roles').select('id, name').order('name')),
      read(supabase.from('member_groups').select('id, name').order('name')),
    ])
    if (!ok) { setState({ loading: false, error: message }); return }
    setRows(data || [])
    setCustomRoles(roles.data || [])
    setGroups(groupRows.data || [])
    setState({ loading: false, error: null })
  }, [])

  useEffect(() => { load() }, [load])

  const detail = rows.find(r => r.id === detailId) || null
  const teams = useMemo(() => [...new Set(rows.map(r => r.team).filter(Boolean))].sort(), [rows])

  const roles = useMemo(() => roleOptions(customRoles), [customRoles])
  // Current holders per role, for the roles list and the filter.
  const holders = useMemo(() => {
    const counts = {}
    rows.forEach(r => currentPositions(r).forEach(p => { counts[p.title] = (counts[p.title] || 0) + 1 }))
    return counts
  }, [rows])

  const groupCounts = useMemo(() => {
    const counts = {}
    rows.forEach(r => groupIds(r).forEach(id => { counts[id] = (counts[id] || 0) + 1 }))
    return counts
  }, [rows])

  const filtered = useMemo(() => rows.filter(r =>
    (!groupFilter || groupIds(r).includes(Number(groupFilter))) &&
    (status === 'all' || (r.status || 'active') === status) && (!team || r.team === team) &&
    (!roleFilter || (roleFilter === 'none'
      ? currentPositions(r).length === 0
      : currentPositions(r).some(p => p.title === roleFilter)))
  ), [rows, status, team, roleFilter, groupFilter])

  const statusOptions = STATUS_FILTERS.map(f => ({
    ...f,
    count: f.value === 'all' ? rows.length : rows.filter(r => (r.status || 'active') === f.value).length,
  }))

  const printCards = members => {
    if (!members.length) return
    navigate(`/admin/members/cards?ids=${members.map(m => m.id).join(',')}`)
  }

  const setStatusFor = async (members, next, clear) => {
    const ids = members.map(m => m.id)
    const patch = { status: next, updated_at: new Date().toISOString() }
    // Leaving the club stamps the date; coming back clears it.
    if (next === 'active') patch.left_at = null
    const { ok } = await run(
      supabase.from('members').update(patch).in('id', ids),
      { success: `${ids.length} member${ids.length === 1 ? '' : 's'} marked ${next}.`, failure: 'The status did not change.' }
    )
    if (!ok) return
    if (next !== 'active') {
      await run(supabase.from('members').update({ left_at: toDateInput() }).in('id', ids).is('left_at', null))
    }
    ids.forEach(id => logActivity('updated', 'members', id, { name: members.find(m => m.id === id)?.full_name, status: next }))
    clear?.()
    setBulkStatus(false)
    load()
  }

  const deleteMember = async () => {
    const m = pendingDelete
    const { ok } = await run(
      supabase.from('members').delete().eq('id', m.id),
      { success: `${m.full_name} removed from the roster.`, failure: 'The member was not removed.' }
    )
    if (!ok) return
    logActivity('deleted', 'members', m.id, { name: m.full_name })
    setPendingDelete(null)
    setDetailId(null)
    load()
  }

  const exportHeaders = [
    'Member code', 'Name', 'Email', 'Phone', 'Student ID', 'Department', 'Study year', 'Team',
    'Roles', 'Status', 'Card', 'Joined', 'Left',
  ]
  const exportRows = filtered.map(r => [
    r.member_code, r.full_name, r.email, r.phone, r.student_id, r.department, r.study_year, r.team,
    currentPositions(r).map(p => positionLabel(p.title)).join(', '),
    r.status, r.card_status, formatDate(r.joined_at), r.left_at ? formatDate(r.left_at) : '',
  ])

  const columns = useMemo(() => [
    {
      header: 'Name',
      accessorKey: 'full_name',
      cell: ({ row }) => (
        <span className="flex items-center gap-2.5 min-w-0">
          <Avatar member={row.original} size={30} />
          <span className="min-w-0 block">
            <span className="block text-sm font-semibold adm-truncate" style={{ maxWidth: 210 }}>{row.original.full_name}</span>
            <span className="adm-data block text-[11px] adm-truncate" style={{ color: 'var(--adm-silk-faint)', maxWidth: 210 }}>
              {row.original.email}
            </span>
          </span>
        </span>
      ),
    },
    { header: 'Member no.', accessorKey: 'member_code', cell: ({ row }) => (
      <span className="adm-data text-[12px]">{row.original.member_code || '—'}</span>
    )},
    {
      header: 'Role',
      id: 'role',
      accessorFn: r => currentPositions(r).map(p => positionLabel(p.title)).join(', '),
      cell: ({ row }) => {
        const current = currentPositions(row.original)
        if (!current.length) return <span className="text-[13px]" style={{ color: 'var(--adm-silk-faint)' }}>Member</span>
        return (
          <span className="flex flex-wrap gap-1">
            {current.map(p => (
              <Badge key={p.id} tone="signal">{positionLabel(p.title)}{p.team ? ` · ${p.team}` : ''}</Badge>
            ))}
          </span>
        )
      },
    },
    { header: 'Team', accessorKey: 'team', cell: ({ row }) => (
      <span className="text-[13px]" style={{ color: 'var(--adm-silk-dim)' }}>{row.original.team || '—'}</span>
    )},
    { header: 'Department', accessorKey: 'department', cell: ({ row }) => (
      <span className="text-[13px]" style={{ color: 'var(--adm-silk-dim)' }}>{row.original.department || '—'}</span>
    )},
    { header: 'Status', accessorKey: 'status', cell: ({ row }) => <StatusBadge status={row.original.status || 'active'} /> },
    {
      header: 'Joined',
      accessorKey: 'joined_at',
      cell: ({ row }) => <span className="adm-data text-[12px]">{formatDate(row.original.joined_at || row.original.created_at)}</span>,
    },
    {
      header: '',
      id: 'actions',
      enableSorting: false,
      cell: ({ row }) => {
        const m = row.original
        return (
          <div className="flex items-center justify-end gap-0.5">
            <IconButton icon={Eye} label="View details" onClick={() => setDetailId(m.id)} />
            <IconButton icon={Pencil} label="Edit" onClick={() => setForm({ member: m })} />
            <IconButton icon={Users} label="Add to group" onClick={() => setGrouping({ members: [m] })} />
            <IconButton icon={Trash2} label="Remove member" danger onClick={() => setPendingDelete(m)} />
          </div>
        )
      },
    },
  ], [])

  return (
    <div>
      <PageHeader
        eyebrow="Operate"
        title="Members"
        description="The club roster. Every member gets a number and a card the moment they are added or approved."
        actions={
          <>
            <ExportMenu
              filename={`members-${new Date().toISOString().slice(0, 10)}`}
              title="Members"
              subtitle={formatDateTime(new Date())}
              headers={exportHeaders}
              rows={exportRows}
              statusColumnIndex={9}
              disabled={!filtered.length}
            />
            <Button icon={Shield} onClick={() => setRolesOpen(true)}>Roles</Button>
            <Button icon={Users} onClick={() => setGroupsOpen(true)}>Groups</Button>
            <Button icon={FileSpreadsheet} onClick={() => setImportOpen(true)}>Import</Button>
            <Button icon={Printer} disabled={!filtered.length} onClick={() => printCards(filtered)}>
              Print {filtered.length === rows.length ? 'all' : filtered.length} cards
            </Button>
            <Button variant="primary" icon={UserRoundPlus} onClick={() => setForm({ member: null })}>Add a member</Button>
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
          enableSelection
          searchPlaceholder="Search by name, email, number, team…"
          toolbar={
            <div className="flex flex-wrap items-center gap-2">
              <FilterTabs options={statusOptions} value={status} onChange={setStatus} label="Status filter" />
              {teams.length > 0 && (
                <select className="adm-input" style={{ width: 'auto', height: 40 }} value={team}
                  onChange={e => setTeam(e.target.value)} aria-label="Team filter">
                  <option value="">All teams</option>
                  {teams.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              )}
              <select className="adm-input" style={{ width: 'auto', height: 40 }} value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)} aria-label="Role filter">
                <option value="">All roles</option>
                <option value="none">No role</option>
                {roles.map(r => <option key={r.value} value={r.value}>{r.label}{holders[r.value] ? ` (${holders[r.value]})` : ''}</option>)}
              </select>
              {groups.length > 0 && (
                <select className="adm-input" style={{ width: 'auto', height: 40 }} value={groupFilter}
                  onChange={e => setGroupFilter(e.target.value)} aria-label="Group filter">
                  <option value="">All groups</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name} ({groupCounts[g.id] || 0})</option>)}
                </select>
              )}
            </div>
          }
          bulkActions={(selected, clear) => (
            <>
              <Button size="sm" variant="primary" icon={Printer} onClick={() => printCards(selected)}>
                Print {selected.length} card{selected.length === 1 ? '' : 's'}
              </Button>
              {bulkStatus ? (
                <select className="adm-input" style={{ width: 'auto', height: 32 }} autoFocus defaultValue=""
                  aria-label="New status" onBlur={() => setBulkStatus(false)}
                  onChange={e => e.target.value && setStatusFor(selected, e.target.value, clear)}>
                  <option value="" disabled>Mark as…</option>
                  {MEMBER_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              ) : (
                <Button size="sm" icon={UserCheck} onClick={() => setBulkStatus(true)}>Change status</Button>
              )}
              <Button size="sm" icon={Users} onClick={() => setGrouping({ members: selected, clear })}>Add to group</Button>
            </>
          )}
          emptyState={
            rows.length === 0 ? (
              <EmptyState
                icon={UserCheck}
                title="No members yet"
                description="Approve an application, add a member by hand, or import your existing roster from Excel or CSV."
                action={
                  <span className="flex gap-2">
                    <Button icon={FileSpreadsheet} onClick={() => setImportOpen(true)}>Import from Excel</Button>
                    <Button variant="primary" icon={UserRoundPlus} onClick={() => setForm({ member: null })}>Add a member</Button>
                  </span>
                }
              />
            ) : (
              <EmptyState compact icon={UserCheck} title="Nobody in this view" description="Try another status, team, role or group." />
            )
          }
        />
      )}

      <Drawer
        open={!!detail}
        onClose={() => setDetailId(null)}
        title={detail?.full_name || ''}
        subtitle={detail ? `${detail.member_code || ''} · joined ${formatDate(detail.joined_at || detail.created_at)}` : ''}
        badge={detail && <StatusBadge status={detail.status || 'active'} />}
        width={520}
        footer={
          detail && (
            <>
              <IconButton icon={Trash2} label="Remove member" danger onClick={() => setPendingDelete(detail)} />
              <span className="flex-1" />
              <Button icon={Pencil} onClick={() => setForm({ member: detail })}>Edit</Button>
              <Link to={`/admin/members/${detail.id}/card`} className="adm-btn adm-btn-primary">
                <IdCard size={15} /> Print card
              </Link>
            </>
          )
        }
      >
        {detail && (
          <div className="space-y-6">
            <PhotoUpload member={detail} onUpdated={photo_url => {
              setRows(rs => rs.map(r => r.id === detail.id ? { ...r, photo_url } : r))
            }} />
            <div className="grid grid-cols-2 gap-4">
              <DetailRow label="Email" mono>{detail.email}</DetailRow>
              <DetailRow label="Phone" mono>{detail.phone || '—'}</DetailRow>
              <DetailRow label="Student ID" mono>{detail.student_id || '—'}</DetailRow>
              <DetailRow label="Study year">{detail.study_year || '—'}</DetailRow>
              <DetailRow label="Department">{detail.department || '—'}</DetailRow>
              <DetailRow label="Team">{detail.team || '—'}</DetailRow>
              <DetailRow label="Joined">{formatDate(detail.joined_at || detail.created_at)}</DetailRow>
              {detail.left_at && <DetailRow label="Left">{formatDate(detail.left_at)}</DetailRow>}
              {detail.birth_date && <DetailRow label="Date of birth">{formatDate(detail.birth_date)}</DetailRow>}
              {detail.gender && <DetailRow label="Gender">{GENDERS.find(g => g.value === detail.gender)?.label}</DetailRow>}
              <DetailRow label="Card"><StatusBadge status={detail.card_status} /></DetailRow>
            </div>

            <PositionsSection
              member={detail}
              onAdd={() => setPositionForm({ position: null, memberId: detail.id })}
              onEdit={position => setPositionForm({ position, memberId: detail.id })}
              onChanged={load}
            />

            <GroupsSection
              member={detail}
              groups={groups}
              onAdd={() => setGrouping({ members: [detail] })}
              onChanged={load}
            />

            {canTasks && <TasksSection member={detail} />}

            <DetailRow label="Skills"><TagList items={detail.skills} empty="None listed" /></DetailRow>
            <DetailRow label="Interests"><TagList items={detail.interests} empty="None listed" /></DetailRow>
            {detail.notes && (
              <DetailRow label="Internal notes"><p className="whitespace-pre-wrap leading-relaxed">{detail.notes}</p></DetailRow>
            )}
          </div>
        )}
      </Drawer>

      <MemberFormModal
        open={!!form}
        member={form?.member || null}
        teams={teams}
        customRoles={customRoles}
        onClose={() => setForm(null)}
        onSaved={load}
      />

      <ImportMembersModal
        open={importOpen}
        existing={rows}
        onClose={() => setImportOpen(false)}
        onImported={load}
      />

      <PositionModal
        open={!!positionForm}
        position={positionForm?.position || null}
        memberId={positionForm?.memberId}
        members={rows}
        teams={teams}
        customRoles={customRoles}
        onClose={() => setPositionForm(null)}
        onSaved={load}
      />

      <RolesModal
        open={rolesOpen}
        customRoles={customRoles}
        holders={holders}
        onClose={() => setRolesOpen(false)}
        onChanged={load}
        onPick={value => { setRoleFilter(value); setRolesOpen(false) }}
      />

      <GroupsModal
        open={groupsOpen}
        groups={groups}
        counts={groupCounts}
        onClose={() => setGroupsOpen(false)}
        onChanged={load}
        onPick={value => { setGroupFilter(value); setGroupsOpen(false) }}
      />

      <AddToGroupModal
        open={!!grouping}
        members={grouping?.members || []}
        groups={groups}
        onClose={() => setGrouping(null)}
        onSaved={() => { grouping?.clear?.(); load() }}
      />

      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={deleteMember}
        title={`Remove ${pendingDelete?.full_name || 'this member'}?`}
        message="Their record, positions and card are deleted and the card stops verifying. Tasks and borrow history stay but lose the link to them. To keep their history, mark them alumni instead."
        confirmLabel="Remove member"
        busyLabel="Removing…"
      />
    </div>
  )
}

function currentPositions(member) {
  return sortPositions(member.member_positions || []).filter(p => isCurrentTerm(p))
}

function groupIds(member) {
  return (member.member_group_members || []).map(g => g.group_id)
}

function Avatar({ member, size }) {
  return (
    <span className="rounded-full overflow-hidden shrink-0 flex items-center justify-center text-[11px] font-bold"
      style={{ width: size, height: size, background: 'var(--adm-panel-raise)', color: 'var(--adm-silk-faint)' }}>
      {member.photo_url
        ? <img src={member.photo_url} alt="" className="w-full h-full object-cover" />
        : (member.full_name || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()}
    </span>
  )
}

function SectionHeading({ icon: Icon, title, action }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <p className="adm-eyebrow flex items-center gap-1.5"><Icon size={13} /> {title}</p>
      {action}
    </div>
  )
}

function PositionsSection({ member, onAdd, onEdit, onChanged }) {
  const positions = sortPositions(member.member_positions || [])

  const endTerm = async p => {
    const { ok } = await run(
      supabase.from('member_positions').update({ term_end: toDateInput() }).eq('id', p.id),
      { success: `${positionLabel(p.title)} term ended.`, failure: 'The term did not end.' }
    )
    if (!ok) return
    logActivity('updated', 'member_positions', p.id, { name: positionLabel(p.title), member: member.full_name })
    onChanged()
  }

  return (
    <div>
      <SectionHeading icon={Crown} title="Roles"
        action={<Button size="sm" variant="ghost" icon={Plus} onClick={onAdd}>Assign role</Button>} />
      {positions.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--adm-silk-faint)' }}>No role. Regular member.</p>
      ) : (
        <ul className="space-y-1.5">
          {positions.map(p => {
            const current = isCurrentTerm(p)
            return (
              <li key={p.id} className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ background: 'var(--adm-board-sunk)', opacity: current ? 1 : 0.65 }}>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold">
                    {positionLabel(p.title)}{p.team ? ` · ${p.team}` : ''}
                  </span>
                  <span className="adm-data block text-[11px]" style={{ color: 'var(--adm-silk-faint)' }}>
                    {formatDate(p.term_start)} → {p.term_end ? formatDate(p.term_end) : 'present'}
                  </span>
                </span>
                {current && <Badge tone="ok">Current</Badge>}
                <IconButton icon={Pencil} label="Edit term" size={14} onClick={() => onEdit(p)} />
                {current && <IconButton icon={CalendarX} label="End term today" size={14} onClick={() => endTerm(p)} />}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function GroupsSection({ member, groups, onAdd, onChanged }) {
  const mine = groups.filter(g => groupIds(member).includes(g.id))

  const leave = async g => {
    const { ok } = await run(
      supabase.from('member_group_members').delete().eq('group_id', g.id).eq('member_id', member.id),
      { success: `${member.full_name} removed from ${g.name}.`, failure: 'They were not removed from the group.' }
    )
    if (!ok) return
    logActivity('updated', 'member_groups', g.id, { name: g.name, removed: member.full_name })
    onChanged()
  }

  return (
    <div>
      <SectionHeading icon={Users} title="Groups"
        action={<Button size="sm" variant="ghost" icon={Plus} onClick={onAdd}>Add to group</Button>} />
      {mine.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--adm-silk-faint)' }}>Not in any group.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {mine.map(g => (
            <li key={g.id} className="flex items-center gap-1 pl-3 pr-1 py-1 rounded-lg text-sm font-semibold"
              style={{ background: 'var(--adm-board-sunk)' }}>
              {g.name}
              <IconButton icon={X} label={`Remove from ${g.name}`} size={13} onClick={() => leave(g)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function TasksSection({ member }) {
  const [tasks, setTasks] = useState(null)
  const [projects, setProjects] = useState([])
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    const { ok, data } = await read(
      supabase.from('member_tasks').select('*, project:projects(id, title_en)')
        .eq('assignee_id', member.id).order('due_date', { ascending: true, nullsFirst: false })
    )
    setTasks(ok ? data : [])
  }, [member.id])

  useEffect(() => { load() }, [load])

  const openAdd = async () => {
    if (!projects.length) {
      const { data } = await read(supabase.from('projects').select('id, title_en').order('title_en'))
      setProjects(data || [])
    }
    setAdding(true)
  }

  const open = (tasks || []).filter(isOpenTask)
  const doneCount = (tasks || []).length - open.length

  return (
    <div>
      <SectionHeading icon={ListChecks} title={`Tasks${open.length ? ` · ${open.length} open` : ''}`}
        action={<Button size="sm" variant="ghost" icon={Plus} onClick={openAdd}>Assign</Button>} />
      {tasks === null ? (
        <Loader2 size={14} className="adm-spin" style={{ color: 'var(--adm-silk-faint)' }} />
      ) : open.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--adm-silk-faint)' }}>
          Nothing open.{doneCount ? ` ${doneCount} finished.` : ''}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {open.map(t => (
            <li key={t.id} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'var(--adm-board-sunk)' }}>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold adm-truncate">{t.title}</span>
                <span className="block text-[11px]" style={{ color: isOverdue(t) ? 'var(--adm-fault)' : 'var(--adm-silk-faint)' }}>
                  {t.project?.title_en ? `${t.project.title_en} · ` : ''}
                  {t.due_date ? `due ${formatDate(t.due_date)}` : 'no due date'}
                </span>
              </span>
              <StatusBadge status={t.status} />
            </li>
          ))}
        </ul>
      )}
      {(tasks || []).length > 0 && (
        <Link to={`/admin/tasks?assignee=${member.id}&status=all`} className="inline-block mt-2 text-xs font-semibold"
          style={{ color: 'var(--adm-signal)' }}>
          See all their tasks →
        </Link>
      )}
      <TaskModal
        open={adding}
        defaults={{ assignee_id: member.id }}
        members={[member]}
        projects={projects}
        onClose={() => setAdding(false)}
        onSaved={load}
      />
    </div>
  )
}

function PhotoUpload({ member, onUpdated }) {
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
        supabase.from('members').update({ photo_url: url }).eq('id', member.id),
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
      <Avatar member={member} size={56} />
      <label className="adm-btn adm-btn-sm" style={{ cursor: busy ? 'default' : 'pointer' }}>
        {busy ? <Loader2 size={14} className="adm-spin" /> : <Upload size={14} />}
        {member.photo_url ? 'Replace photo' : 'Add photo'}
        <input type="file" accept="image/*" className="sr-only" disabled={busy} onChange={pick} />
      </label>
    </div>
  )
}
