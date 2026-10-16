import { useCallback, useEffect, useMemo, useState } from 'react'
import { Building2, Trophy, Users } from 'lucide-react'
import { read, supabase } from '../lib/db'
import useAdminStore from '../store/adminStore'
import useQueryParam from '../hooks/useQueryParam'
import { formatDate, formatDateTime } from '../lib/format'
import { hasPermission } from '../lib/permissions'
import { balances } from '../lib/points'
import PageHeader, { FilterTabs } from '../components/ui/PageHeader'
import DataTable from '../components/ui/DataTable'
import EmptyState, { ErrorState } from '../components/ui/EmptyState'
import ExportMenu from '../components/ui/ExportMenu'
import { StatusBadge } from '../components/ui/Badge'
import Panel from '../components/ui/Panel'
import PointsHistoryModal from '../components/hr/PointsHistoryModal'

/**
 * A department head's view of the departments they head: who is in them and
 * how many points each member has. HR and super admins can open any
 * department here. The database only hands a head their own members.
 */
export default function DepartmentPage() {
  const me = useAdminStore(s => s.adminProfile)
  const seesAll = hasPermission(me?.role?.name, 'hr.manage')

  const [departments, setDepartments] = useState([])
  const [members, setMembers] = useState([])
  const [entries, setEntries] = useState([])
  const [admins, setAdmins] = useState({})
  const [state, setState] = useState({ loading: true, error: null })
  const [membersLoading, setMembersLoading] = useState(false)
  const [selected, setSelected] = useQueryParam('d', '')
  const [historyOf, setHistoryOf] = useState(null)

  const loadDepartments = useCallback(async () => {
    setState(s => ({ ...s, error: null }))
    const res = seesAll
      ? await read(supabase.from('departments').select('id, name, color, description').order('sort_order'))
      : await read(supabase.from('department_managers')
        .select('department:departments(id, name, color, description, sort_order)').eq('admin_user_id', me?.id))
    if (!res.ok) { setState({ loading: false, error: res.message }); return }
    const list = seesAll ? res.data : (res.data || []).map(r => r.department).filter(Boolean).sort((a, b) => a.sort_order - b.sort_order)
    setDepartments(list || [])
    setState({ loading: false, error: null })
  }, [seesAll, me?.id])

  useEffect(() => { loadDepartments() }, [loadDepartments])

  const current = departments.find(d => String(d.id) === selected) || departments[0] || null

  const loadMembers = useCallback(async () => {
    if (!current) { setMembers([]); setEntries([]); return }
    setMembersLoading(true)
    const links = await read(supabase.from('member_departments').select('member_id').eq('department_id', current.id))
    const ids = (links.data || []).map(l => l.member_id)
    if (!ids.length) { setMembers([]); setEntries([]); setMembersLoading(false); return }
    const [memberRes, entryRes, adminRes] = await Promise.all([
      read(supabase.from('members')
        .select('id, full_name, email, phone, member_code, study_year, department, status, joined_at, created_at')
        .in('id', ids).order('full_name')),
      read(supabase.from('point_entries').select('*').in('member_id', ids)),
      read(supabase.from('admin_users').select('user_id, full_name, email')),
    ])
    setMembers(memberRes.data || [])
    setEntries(entryRes.data || [])
    setAdmins(Object.fromEntries((adminRes.data || []).map(a => [a.user_id, a.full_name || a.email])))
    setMembersLoading(false)
  }, [current?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadMembers() }, [loadMembers])

  const totals = useMemo(() => balances(entries), [entries])
  const rows = useMemo(() => members.map(m => ({ ...m, points: totals[m.id] || 0 })), [members, totals])
  const active = rows.filter(m => (m.status || 'active') === 'active').length
  const top = [...rows].sort((a, b) => b.points - a.points)[0]

  const columns = useMemo(() => [
    {
      header: 'Member',
      accessorKey: 'full_name',
      cell: ({ row }) => (
        <span className="min-w-0 block">
          <span className="block text-sm font-semibold adm-truncate" style={{ maxWidth: 220 }}>{row.original.full_name}</span>
          <span className="adm-data block text-[11px]" style={{ color: 'var(--adm-silk-faint)' }}>{row.original.member_code || '—'}</span>
        </span>
      ),
    },
    { header: 'Email', accessorKey: 'email', cell: ({ row }) => <span className="adm-data text-[12px]">{row.original.email}</span> },
    { header: 'Phone', accessorKey: 'phone', cell: ({ row }) => <span className="adm-data text-[12px]">{row.original.phone || '—'}</span> },
    { header: 'Study', accessorKey: 'department', cell: ({ row }) => (
      <span className="text-[13px]" style={{ color: 'var(--adm-silk-dim)' }}>
        {[row.original.department, row.original.study_year].filter(Boolean).join(' · ') || '—'}
      </span>
    )},
    { header: 'Status', accessorKey: 'status', cell: ({ row }) => <StatusBadge status={row.original.status || 'active'} /> },
    { header: 'Points', accessorKey: 'points', cell: ({ row }) => <span className="adm-data text-sm font-semibold">{row.original.points}</span> },
  ], [])

  if (state.error) return <Panel><ErrorState message={state.error} onRetry={loadDepartments} /></Panel>

  return (
    <div>
      <PageHeader
        eyebrow="People"
        title={current ? current.name : 'My department'}
        description={current?.description || 'The members of your department and their points. Click a member to see how they earned them.'}
        actions={
          <ExportMenu
            filename={`${(current?.name || 'department').toLowerCase()}-members-${new Date().toISOString().slice(0, 10)}`}
            title={current ? `${current.name} members` : 'Members'}
            subtitle={formatDateTime(new Date())}
            headers={['Name', 'Member no.', 'Email', 'Phone', 'Study', 'Status', 'Points', 'Joined']}
            rows={rows.map(m => [m.full_name, m.member_code, m.email, m.phone, [m.department, m.study_year].filter(Boolean).join(' · '),
              m.status, m.points, formatDate(m.joined_at || m.created_at)])}
            statusColumnIndex={5}
            disabled={!rows.length}
          />
        }
      >
        {departments.length > 1 && (
          <div className="mt-4">
            <FilterTabs
              options={departments.map(d => ({ value: String(d.id), label: d.name }))}
              value={current ? String(current.id) : ''}
              onChange={setSelected}
              label="Department"
            />
          </div>
        )}
      </PageHeader>

      {!state.loading && departments.length === 0 ? (
        <Panel>
          <EmptyState
            icon={Building2}
            title="You do not head a department yet"
            description="HR or a super admin assigns department heads from the HR screen."
          />
        </Panel>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <Stat label="Members" value={rows.length} />
            <Stat label="Active" value={active} />
            <Stat label="Points in total" value={rows.reduce((n, m) => n + m.points, 0)} />
            <Stat label="Most points" value={top && top.points > 0 ? top.full_name : '—'} small />
          </div>
          <DataTable
            columns={columns}
            data={rows}
            loading={state.loading || membersLoading}
            getRowId={row => String(row.id)}
            onRowClick={row => setHistoryOf(row)}
            initialSort={[{ id: 'points', desc: true }]}
            searchPlaceholder="Search members…"
            emptyState={<EmptyState compact icon={Users} title="No members in this department" description="Members join it through their interests, or HR adds them by hand." />}
          />
        </>
      )}

      <PointsHistoryModal
        member={historyOf}
        entries={historyOf ? entries.filter(e => e.member_id === historyOf.id) : []}
        admins={admins}
        onClose={() => setHistoryOf(null)}
      />
    </div>
  )
}

function Stat({ label, value, small }) {
  return (
    <Panel className="p-4">
      <p className="adm-eyebrow flex items-center gap-1.5">{label === 'Most points' && <Trophy size={12} />}{label}</p>
      <p className={`mt-2 adm-truncate ${small ? 'text-sm font-semibold' : 'adm-data text-[22px] font-semibold'}`}>{value}</p>
    </Panel>
  )
}
