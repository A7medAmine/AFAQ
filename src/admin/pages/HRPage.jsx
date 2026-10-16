import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, IdCard, Inbox, ListChecks, Pencil, Settings2, Sparkles, Trophy, UserCheck, X } from 'lucide-react'
import { logActivity, read, run, supabase } from '../lib/db'
import useAdminStore from '../store/adminStore'
import { hasPermission } from '../lib/permissions'
import { balances } from '../lib/points'
import PageHeader from '../components/ui/PageHeader'
import Panel, { PanelHead } from '../components/ui/Panel'
import { ErrorState } from '../components/ui/EmptyState'
import Button, { IconButton } from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import { SkeletonPanel } from '../components/ui/Skeleton'
import { CheckField } from '../components/ui/Field'
import DepartmentsModal from '../components/needs/DepartmentsModal'

/**
 * The HR department's home: the club's departments, who heads each one, which
 * interests fill them, and shortcuts to the roster, points and tasks.
 */
export default function HRPage() {
  const [departments, setDepartments] = useState([])
  const [links, setLinks] = useState([]) // member_departments rows
  const [managers, setManagers] = useState([]) // department_managers rows
  const [admins, setAdmins] = useState([])
  const [interests, setInterests] = useState([])
  const [members, setMembers] = useState([])
  const [entries, setEntries] = useState([])
  const [state, setState] = useState({ loading: true, error: null })
  const [editing, setEditing] = useState(false)
  const [interestsOf, setInterestsOf] = useState(null) // department

  const load = useCallback(async () => {
    setState(s => ({ ...s, error: null }))
    const results = await Promise.all([
      read(supabase.from('departments').select('*').order('sort_order')),
      read(supabase.from('member_departments').select('member_id, department_id, source')),
      read(supabase.from('department_managers').select('department_id, admin_user_id')),
      read(supabase.from('admin_users').select('id, full_name, email, is_active, role:admin_roles(name, label)').order('full_name')),
      read(supabase.from('interests').select('key, label_en, is_active').order('sort_order')),
      read(supabase.from('members').select('id, status')),
      read(supabase.from('point_entries').select('member_id, points')),
    ])
    const failed = results.find(r => !r.ok)
    if (failed) { setState({ loading: false, error: failed.message }); return }
    const [d, l, m, a, i, mem, p] = results
    setDepartments(d.data); setLinks(l.data); setManagers(m.data); setAdmins(a.data)
    setInterests(i.data); setMembers(mem.data); setEntries(p.data)
    setState({ loading: false, error: null })
  }, [])

  useEffect(() => { load() }, [load])

  const adminById = useMemo(() => Object.fromEntries(admins.map(a => [a.id, a])), [admins])
  const totals = useMemo(() => balances(entries), [entries])
  const placed = useMemo(() => new Set(links.map(l => l.member_id)), [links])
  const active = members.filter(m => (m.status || 'active') === 'active').length
  const unplaced = members.filter(m => !placed.has(m.id)).length

  const addHead = async (department, adminId) => {
    const admin = adminById[adminId]
    if (!admin) return
    const { ok } = await run(
      supabase.from('department_managers').insert({ department_id: department.id, admin_user_id: admin.id }),
      { success: `${admin.full_name || admin.email} now heads ${department.name}.`, failure: 'The head was not added.' }
    )
    if (!ok) return
    logActivity('updated', 'departments', department.id, { name: department.name, head_added: admin.full_name || admin.email })
    load()
  }

  const removeHead = async (department, admin) => {
    const { ok } = await run(
      supabase.from('department_managers').delete().eq('department_id', department.id).eq('admin_user_id', admin.id),
      { success: `${admin.full_name || admin.email} no longer heads ${department.name}.`, failure: 'The head was not removed.' }
    )
    if (!ok) return
    logActivity('updated', 'departments', department.id, { name: department.name, head_removed: admin.full_name || admin.email })
    load()
  }

  if (state.error) return <Panel><ErrorState message={state.error} onRetry={load} /></Panel>

  return (
    <div>
      <PageHeader
        eyebrow="People"
        title="HR"
        description="Departments, who heads them and who is in them. Members join departments through their interests; you can add or move anyone by hand."
        actions={<Button icon={Pencil} onClick={() => setEditing(true)}>Add or rename departments</Button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Stat label="Members" value={members.length} />
        <Stat label="Active" value={active} />
        <Stat label="Departments" value={departments.length} />
        <Stat label="In no department" value={unplaced} to={unplaced ? '/admin/members?department=none' : null} />
      </div>

      <div className="grid lg:grid-cols-[1fr_280px] gap-5 items-start">
        <div className="space-y-3">
          {state.loading ? <SkeletonPanel rows={4} /> : departments.map(d => {
            const memberIds = links.filter(l => l.department_id === d.id).map(l => l.member_id)
            const heads = managers.filter(m => m.department_id === d.id).map(m => adminById[m.admin_user_id]).filter(Boolean)
            const candidates = admins.filter(a => a.is_active && !heads.some(h => h.id === a.id))
            const points = memberIds.reduce((n, id) => n + (totals[id] || 0), 0)
            const labels = (d.interests || []).map(key => interests.find(i => i.key === key)?.label_en || key)
            return (
              <Panel key={d.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-[15px] font-semibold">
                      <span className="rounded-full shrink-0" style={{ width: 10, height: 10, background: d.color || 'var(--adm-silk-faint)' }} />
                      {d.name}
                    </p>
                    <p className="adm-data text-[11px] mt-1" style={{ color: 'var(--adm-silk-faint)' }}>
                      {memberIds.length} member{memberIds.length === 1 ? '' : 's'} · {points} points
                    </p>
                  </div>
                  <span className="flex gap-2">
                    <Link className="adm-btn adm-btn-sm" to={`/admin/members?department=${d.id}`}>Members</Link>
                    <Link className="adm-btn adm-btn-sm" to={`/admin/department?d=${d.id}`}>Dashboard</Link>
                  </span>
                </div>

                <div className="mt-4 grid sm:grid-cols-2 gap-4">
                  <div>
                    <p className="adm-label">Heads</p>
                    <ul className="flex flex-wrap gap-1.5">
                      {heads.map(h => (
                        <li key={h.id} className="flex items-center gap-1 pl-3 pr-1 py-1 rounded-lg text-sm font-semibold"
                          style={{ background: 'var(--adm-board-sunk)' }}>
                          {h.full_name || h.email}
                          <IconButton icon={X} label={`Remove ${h.full_name || h.email} as head`} size={13} onClick={() => removeHead(d, h)} />
                        </li>
                      ))}
                      {!heads.length && <li className="text-sm" style={{ color: 'var(--adm-silk-faint)' }}>No head yet.</li>}
                    </ul>
                    {candidates.length > 0 && (
                      <select className="adm-input mt-2" style={{ height: 34 }} value="" aria-label={`Add a head to ${d.name}`}
                        onChange={e => e.target.value && addHead(d, Number(e.target.value))}>
                        <option value="">+ Add a head…</option>
                        {candidates.map(a => <option key={a.id} value={a.id}>{a.full_name || a.email} ({a.role?.label})</option>)}
                      </select>
                    )}
                  </div>
                  <div>
                    <p className="adm-label flex items-center justify-between">
                      Joined through interests
                      <Button size="sm" variant="ghost" icon={Settings2} onClick={() => setInterestsOf(d)}>Edit</Button>
                    </p>
                    <p className="flex flex-wrap gap-1">
                      {labels.length ? labels.map(l => <Badge key={l}>{l}</Badge>)
                        : <span className="text-sm" style={{ color: 'var(--adm-silk-faint)' }}>None: members are added by hand.</span>}
                    </p>
                  </div>
                </div>
              </Panel>
            )
          })}
        </div>

        <Panel>
          <PanelHead eyebrow="Shortcuts" title="HR tools" />
          <ul className="p-2">
            <Shortcut to="/admin/members" icon={IdCard} label="Members" hint="Roster, roles, groups, cards" />
            <Shortcut to="/admin/points" icon={Trophy} label="Points" hint="Give, take away, reset" permission="points.manage" />
            <Shortcut to="/admin/tasks" icon={ListChecks} label="Tasks" hint="Done tasks earn points" permission="tasks.manage" />
            <Shortcut to="/admin/review" icon={Inbox} label="Review queue" hint="New membership applications" permission="applications.review" />
            <Shortcut to="/admin/applications" icon={UserCheck} label="Applications" hint="Every application" permission="membership.manage" />
            <Shortcut to="/admin/teams" icon={ClipboardList} label="Review teams" hint="Who interviews whom" permission="membership.manage" />
          </ul>
        </Panel>
      </div>

      <DepartmentsModal open={editing} departments={departments} onClose={() => setEditing(false)} onChanged={load} />

      <InterestsModal
        department={interestsOf}
        interests={interests}
        onClose={() => setInterestsOf(null)}
        onSaved={() => { setInterestsOf(null); load() }}
      />
    </div>
  )
}

function Stat({ label, value, to }) {
  const body = (
    <>
      <p className="adm-eyebrow">{label}</p>
      <p className="mt-2 adm-data text-[22px] font-semibold">{value}</p>
    </>
  )
  return <Panel className="p-4">{to ? <Link to={to} className="block">{body}</Link> : body}</Panel>
}

function Shortcut({ to, icon: Icon, label, hint, permission }) {
  const role = useAdminStore(s => s.adminProfile?.role?.name)
  if (permission && !hasPermission(role, permission)) return null
  return (
    <li>
      <Link to={to} className="flex items-center gap-3 px-3 py-2.5 rounded-lg adm-hover">
        <Icon size={16} style={{ color: 'var(--adm-silk-faint)' }} />
        <span className="min-w-0">
          <span className="block text-sm font-semibold">{label}</span>
          <span className="block text-[11px]" style={{ color: 'var(--adm-silk-faint)' }}>{hint}</span>
        </span>
      </Link>
    </li>
  )
}

/**
 * Which interests put a member in this department. Saving re-sorts the roster:
 * members with a ticked interest join, members placed by an unticked one leave
 * (unless they were added by hand).
 */
function InterestsModal({ department, interests, onClose, onSaved }) {
  const [picked, setPicked] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (department) setPicked(department.interests || []) }, [department])

  const save = async () => {
    setSaving(true)
    const { ok } = await run(
      supabase.from('departments').update({ interests: picked }).eq('id', department.id),
      { success: `${department.name} updated. Members were re-sorted.`, failure: 'The department was not saved.' }
    )
    setSaving(false)
    if (!ok) return
    logActivity('updated', 'departments', department.id, { name: department.name, interests: picked })
    onSaved()
  }

  return (
    <Modal
      open={!!department}
      onClose={onClose}
      title={department ? `Who joins ${department.name}` : ''}
      description="A member with any ticked interest joins this department. Members you added by hand stay either way."
      footer={
        <>
          <Button onClick={onClose} data-dialog-dismiss="true">Cancel</Button>
          <Button variant="primary" icon={Sparkles} onClick={save} busy={saving} busyLabel="Saving…">Save and re-sort</Button>
        </>
      }
    >
      <div className="grid sm:grid-cols-2 gap-x-4 gap-y-2.5">
        {interests.map(i => (
          <CheckField
            key={i.key}
            label={i.label_en}
            description={i.is_active ? null : 'No longer on the join form'}
            checked={picked.includes(i.key)}
            onChange={on => setPicked(p => (on ? [...p, i.key] : p.filter(k => k !== i.key)))}
          />
        ))}
      </div>
    </Modal>
  )
}
