import { useCallback, useEffect, useMemo, useState } from 'react'
import { KeyRound, Loader2, Pencil, Plus, Shield, ShieldOff, Trash2, UserPlus } from 'lucide-react'
import { api, logActivity, read, run, supabase } from '../lib/db'
import useAdminStore from '../store/adminStore'
import { formatDate, formatDateTime, initials } from '../lib/format'
import PageHeader from '../components/ui/PageHeader'
import DataTable from '../components/ui/DataTable'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import EmptyState, { ErrorState } from '../components/ui/EmptyState'
import Button, { IconButton } from '../components/ui/Button'
import ExportMenu from '../components/ui/ExportMenu'
import Badge, { StatusBadge } from '../components/ui/Badge'
import Panel from '../components/ui/Panel'
import AddAdminModal from '../components/AddAdminModal'
import { CheckField, TextField } from '../components/ui/Field'
import { PERMISSIONS, PERMISSION_OPTIONS, permissionsOf } from '../lib/permissions'

export default function AdminUsersPage() {
  const addToast = useAdminStore(s => s.addToast)
  const me = useAdminStore(s => s.adminProfile)

  const [admins, setAdmins] = useState([])
  const [roles, setRoles] = useState([])
  const [state, setState] = useState({ loading: true, error: null })
  const [addOpen, setAddOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [working, setWorking] = useState({})
  const [editingRole, setEditingRole] = useState(null) // a role, or {} for a new one
  const [deletingRole, setDeletingRole] = useState(null)

  const load = useCallback(async () => {
    setState(s => ({ ...s, error: null }))
    const [adminRes, roleRes] = await Promise.all([
      read(supabase.from('admin_users').select('*, role:admin_roles(id, name, label, description)').order('created_at', { ascending: false })),
      read(supabase.from('admin_roles').select('*').order('id')),
    ])
    if (!adminRes.ok) { setState({ loading: false, error: adminRes.message }); return }
    setAdmins(adminRes.data || [])
    setRoles(roleRes.data || [])
    setState({ loading: false, error: null })
  }, [])

  useEffect(() => { load() }, [load])

  const toggleActive = async admin => {
    setWorking(w => ({ ...w, [admin.id]: true }))
    const next = !admin.is_active
    const { ok } = await run(
      supabase.from('admin_users').update({ is_active: next }).eq('id', admin.id),
      {
        success: next
          ? `${admin.full_name || admin.email} can sign in again.`
          : `${admin.full_name || admin.email} can no longer sign in.`,
        failure: 'The account did not change.',
      }
    )
    setWorking(w => ({ ...w, [admin.id]: false }))
    if (ok) setAdmins(list => list.map(a => (a.id === admin.id ? { ...a, is_active: next } : a)))
  }

  const changeRole = async (admin, roleId) => {
    const role = roles.find(r => String(r.id) === String(roleId))
    if (!role) return
    setWorking(w => ({ ...w, [admin.id]: true }))
    const { ok } = await run(
      supabase.from('admin_users').update({ role_id: role.id }).eq('id', admin.id),
      { success: `${admin.full_name || admin.email} is now ${role.label}.`, failure: 'The role did not change.' }
    )
    setWorking(w => ({ ...w, [admin.id]: false }))
    if (ok) {
      logActivity('updated', 'admin_users', admin.id, { name: admin.full_name || admin.email, role: role.name })
      setAdmins(list => list.map(a => (a.id === admin.id ? { ...a, role_id: role.id, role } : a)))
    }
  }

  const deleteRole = async () => {
    const role = deletingRole
    const { ok } = await run(
      supabase.from('admin_roles').delete().eq('id', role.id),
      { success: `${role.label} deleted.`, failure: 'The role was not deleted. Move its admins to another role first.' }
    )
    if (!ok) return
    logActivity('deleted', 'admin_roles', role.id, { name: role.label })
    setDeletingRole(null)
    load()
  }

  const remove = async () => {
    const { ok, message } = await api(`/api/admin/users/${pendingDelete.id}`, { method: 'DELETE' })
    if (!ok) { addToast(message, 'error'); return }
    logActivity('deleted', 'admin_users', pendingDelete.id, { name: pendingDelete.full_name || pendingDelete.email })
    addToast(`${pendingDelete.full_name || pendingDelete.email} removed.`)
    setPendingDelete(null)
    load()
  }

  const columns = useMemo(() => [
    {
      header: 'Admin',
      accessorKey: 'full_name',
      cell: ({ row }) => {
        const a = row.original
        const isMe = a.user_id === me?.user_id
        return (
          <span className="flex items-center gap-3 min-w-0">
            {a.avatar_url ? (
              <img src={a.avatar_url} alt="" className="rounded-lg object-cover shrink-0" style={{ width: 32, height: 32 }} />
            ) : (
              <span
                className="adm-pixel flex items-center justify-center rounded-lg text-[11px] shrink-0"
                style={{ width: 32, height: 32, background: 'var(--adm-board-sunk)', color: 'var(--adm-silk-dim)' }}
                aria-hidden="true"
              >
                {initials(a.full_name || a.email)}
              </span>
            )}
            <span className="min-w-0">
              <span className="flex items-center gap-2">
                <span className="text-sm font-semibold adm-truncate" style={{ maxWidth: 180 }}>
                  {a.full_name || '—'}
                </span>
                {isMe && <Badge tone="signal">You</Badge>}
              </span>
              <span className="adm-data block text-[11px] adm-truncate" style={{ color: 'var(--adm-silk-faint)', maxWidth: 210 }}>
                {a.email}
              </span>
            </span>
          </span>
        )
      },
    },
    {
      header: 'Role',
      id: 'role',
      accessorFn: row => row.role?.label || '',
      cell: ({ row }) => {
        const a = row.original
        // Changing your own role could lock you out of this screen.
        if (a.user_id === me?.user_id) return <Badge tone="signal">{a.role?.label || 'No role'}</Badge>
        return (
          <select
            className="adm-input adm-cell-select"
            aria-label={`Role of ${a.full_name || a.email}`}
            value={a.role_id || ''}
            disabled={working[a.id]}
            onClick={e => e.stopPropagation()}
            onChange={e => changeRole(a, e.target.value)}
          >
            {!a.role_id && <option value="">No role</option>}
            {roles.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        )
      },
    },
    {
      header: 'Access',
      accessorKey: 'is_active',
      cell: ({ row }) => <StatusBadge status={row.original.is_active ? 'active' : 'inactive'} />,
    },
    {
      header: 'Added',
      accessorKey: 'created_at',
      cell: ({ row }) => <span className="adm-data text-[12px]">{formatDate(row.original.created_at)}</span>,
    },
    {
      header: '',
      id: 'actions',
      enableSorting: false,
      cell: ({ row }) => {
        const a = row.original
        const isMe = a.user_id === me?.user_id
        return (
          <div className="flex items-center justify-end gap-0.5">
            {working[a.id] && <Loader2 size={14} className="adm-spin mr-1" style={{ color: 'var(--adm-silk-faint)' }} />}
            {/* Locking yourself out of the console is not a recoverable mistake. */}
            <IconButton
              icon={a.is_active ? ShieldOff : Shield}
              label={isMe ? 'You cannot change your own access' : a.is_active ? 'Suspend access' : 'Restore access'}
              disabled={isMe || working[a.id]}
              onClick={() => toggleActive(a)}
            />
            <IconButton
              icon={Trash2}
              label={isMe ? 'You cannot delete your own account' : 'Delete admin'}
              danger
              disabled={isMe}
              onClick={() => setPendingDelete(a)}
            />
          </div>
        )
      },
    },
  ], [me, working, roles]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <PageHeader
        eyebrow="Console"
        title="Admins"
        description="Who can sign in to this console, and what each of them may change."
        actions={
          <>
            <ExportMenu
              filename={`admins-${new Date().toISOString().slice(0, 10)}`}
              title="Admins"
              subtitle={formatDateTime(new Date())}
              headers={['Name', 'Email', 'Role', 'Access', 'Added']}
              rows={admins.map(a => [a.full_name, a.email, a.role?.label, a.is_active ? 'active' : 'inactive', formatDate(a.created_at)])}
              statusColumnIndex={3}
              disabled={!admins.length}
            />
            <Button variant="primary" icon={UserPlus} onClick={() => setAddOpen(true)}>Add an admin</Button>
          </>
        }
      />

      {state.error ? (
        <Panel><ErrorState message={state.error} onRetry={load} /></Panel>
      ) : (
        <DataTable
          columns={columns}
          data={admins}
          loading={state.loading}
          getRowId={row => String(row.id)}
          searchPlaceholder="Search admins…"
          defaultPageSize={25}
          emptyState={
            <EmptyState
              icon={Shield}
              title="No admin accounts"
              description="Add someone to give them access to this console."
              action={<Button variant="primary" icon={UserPlus} onClick={() => setAddOpen(true)}>Add an admin</Button>}
            />
          }
        />
      )}

      <Panel className="mt-5 p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <p className="adm-eyebrow">Roles</p>
            <p className="text-sm mt-1" style={{ color: 'var(--adm-silk-dim)' }}>
              What each role may open. Make one for a team, such as logistics, and tick the screens it needs.
            </p>
          </div>
          <Button icon={Plus} onClick={() => setEditingRole({})}>New role</Button>
        </div>
        <ul>
          {roles.map(role => {
            const isSuper = role.name === 'super_admin'
            const granted = PERMISSION_OPTIONS.filter(p => permissionsOf(role).includes(p.value))
            const inUse = admins.filter(a => a.role_id === role.id).length
            return (
              <li key={role.id} className="flex items-start gap-3 py-3" style={{ borderTop: '1px solid var(--adm-trace)' }}>
                <KeyRound size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--adm-silk-faint)' }} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    {role.label}
                    <span className="adm-data text-[11px] font-normal ml-2" style={{ color: 'var(--adm-silk-faint)' }}>
                      {inUse} admin{inUse === 1 ? '' : 's'}
                    </span>
                  </p>
                  {role.description && <p className="text-xs mt-0.5" style={{ color: 'var(--adm-silk-dim)' }}>{role.description}</p>}
                  <p className="flex flex-wrap gap-1 mt-1.5">
                    {isSuper ? <Badge tone="ok">Everything</Badge> : granted.length
                      ? granted.map(p => <Badge key={p.value}>{p.label}</Badge>)
                      : <span className="text-xs" style={{ color: 'var(--adm-silk-faint)' }}>No screens yet</span>}
                  </p>
                </div>
                {!isSuper && (
                  <span className="flex items-center gap-0.5 shrink-0">
                    <IconButton icon={Pencil} label={`Edit ${role.label}`} onClick={() => setEditingRole(role)} />
                    <IconButton
                      icon={Trash2}
                      danger
                      label={inUse ? 'Move its admins to another role first' : `Delete ${role.label}`}
                      disabled={inUse > 0}
                      onClick={() => setDeletingRole(role)}
                    />
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      </Panel>

      <RoleEditor
        role={editingRole}
        roles={roles}
        onClose={() => setEditingRole(null)}
        onSaved={() => { setEditingRole(null); load() }}
      />

      <ConfirmDialog
        open={!!deletingRole}
        onClose={() => setDeletingRole(null)}
        onConfirm={deleteRole}
        title="Delete this role?"
        message={deletingRole ? `${deletingRole.label} is removed for good. No admin holds it right now.` : ''}
        confirmLabel="Delete role"
      />

      <AddAdminModal
        open={addOpen}
        roles={roles}
        onClose={() => setAddOpen(false)}
        onAdded={load}
        addToast={addToast}
      />

      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={remove}
        title="Delete this admin?"
        message={
          pendingDelete
            ? `${pendingDelete.full_name || pendingDelete.email} loses console access immediately and their sign-in is deleted. To keep the account but block it, suspend access instead.`
            : ''
        }
        confirmLabel="Delete admin"
      />
    </div>
  )
}

/** Turns a label into the role's stored name: "Logistics team" becomes "logistics_team". */
const roleSlug = label => label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

function RoleEditor({ role, roles, onClose, onSaved }) {
  const open = !!role
  const isNew = open && !role.id
  const [form, setForm] = useState({ label: '', description: '', permissions: [] })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm({
      label: role.label || '',
      description: role.description || '',
      permissions: role.id ? [...permissionsOf(role)] : [],
    })
    setError(null)
  }, [open, role])

  const toggle = (value, on) => setForm(f => ({
    ...f,
    permissions: on ? [...f.permissions, value] : f.permissions.filter(p => p !== value),
  }))

  const submit = async () => {
    const label = form.label.trim()
    // Non-Latin labels still need a stored name, so fall back to a numbered one.
    const name = isNew ? roleSlug(label) || `role_${Date.now()}` : role.name
    if (!label) { setError('Give the role a name.'); return }
    if (roles.some(r => r.id !== role.id && (r.name === name || r.label.toLowerCase() === label.toLowerCase()))) {
      setError('A role with that name already exists.')
      return
    }

    // Saved in the editor's order so lists read the same everywhere.
    const permissions = PERMISSION_OPTIONS.map(p => p.value).filter(v => form.permissions.includes(v))
    const values = { label, description: form.description.trim() || null, permissions }
    setSaving(true)
    const { ok, data } = await run(
      isNew
        ? supabase.from('admin_roles').insert({ name, ...values }).select('id').single()
        : supabase.from('admin_roles').update(values).eq('id', role.id),
      { success: isNew ? `${label} created.` : `${label} saved.`, failure: 'The role was not saved.' }
    )
    setSaving(false)
    if (!ok) return
    logActivity(isNew ? 'created' : 'updated', 'admin_roles', isNew ? data?.id : role.id, { name: label, permissions })
    onSaved()
  }

  const builtIn = open && !isNew && PERMISSIONS[role.name] && !Array.isArray(role.permissions)

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={isNew ? 'New role' : `Edit ${role?.label || 'role'}`}
      description="Admins with this role see only the screens ticked here. Changes reach them the next time they reload."
      footer={
        <>
          <Button onClick={onClose} data-dialog-dismiss="true">Cancel</Button>
          <Button variant="primary" onClick={submit} busy={saving} busyLabel="Saving…">{isNew ? 'Create role' : 'Save role'}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextField label="Name" required value={form.label} error={error} placeholder="Logistics"
          onChange={e => { setForm(f => ({ ...f, label: e.target.value })); setError(null) }} />
        <TextField label="Description" value={form.description} placeholder="Needs lists, inventory and borrowing"
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        <div>
          <span className="adm-label">Screens this role can open</span>
          {builtIn && (
            <p className="text-xs mb-2" style={{ color: 'var(--adm-silk-faint)' }}>
              A built-in role, showing its default screens. Saving keeps your choices from now on.
            </p>
          )}
          <div className="grid sm:grid-cols-2 gap-x-4 gap-y-2.5">
            {PERMISSION_OPTIONS.map(p => (
              <CheckField
                key={p.value}
                label={p.label}
                description={p.description}
                checked={form.permissions.includes(p.value)}
                onChange={on => toggle(p.value, on)}
              />
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}
