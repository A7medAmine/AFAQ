import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Shield, ShieldOff, Trash2, UserPlus } from 'lucide-react'
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
import { SelectField, TextField } from '../components/ui/Field'

export default function AdminUsersPage() {
  const addToast = useAdminStore(s => s.addToast)
  const me = useAdminStore(s => s.adminProfile)

  const [admins, setAdmins] = useState([])
  const [roles, setRoles] = useState([])
  const [state, setState] = useState({ loading: true, error: null })
  const [addOpen, setAddOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [working, setWorking] = useState({})

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
      cell: ({ row }) => <Badge tone="signal">{row.original.role?.label || 'No role'}</Badge>,
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
  ], [me, working]) // eslint-disable-line react-hooks/exhaustive-deps

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

      {roles.length > 0 && (
        <Panel className="mt-5 p-5">
          <p className="adm-eyebrow mb-3">What each role may change</p>
          <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
            {roles.map(role => (
              <div key={role.id} className="flex gap-3">
                <dt className="text-sm font-semibold shrink-0" style={{ minWidth: 110 }}>{role.label}</dt>
                <dd className="text-sm" style={{ color: 'var(--adm-silk-dim)' }}>
                  {role.description || 'No description set.'}
                </dd>
              </div>
            ))}
          </dl>
        </Panel>
      )}

      <AddAdmin
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

function AddAdmin({ open, roles, onClose, onAdded, addToast }) {
  const [form, setForm] = useState({ full_name: '', email: '', password: '', role_id: '' })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setForm({ full_name: '', email: '', password: '', role_id: roles[0]?.id || '' })
      setErrors({})
    }
  }, [open, roles])

  const set = (key, value) => {
    setForm(f => ({ ...f, [key]: value }))
    setErrors(e => ({ ...e, [key]: undefined }))
  }

  const submit = async () => {
    const next = {}
    if (!form.full_name.trim()) next.full_name = 'Enter their name.'
    if (!form.email.trim()) next.email = 'Enter an email address.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'That is not a valid email address.'
    if (form.password.length < 8) next.password = 'Use at least 8 characters.'
    if (!form.role_id) next.role_id = 'Pick a role.'
    if (Object.keys(next).length) { setErrors(next); return }

    setSaving(true)
    const { ok, message } = await api('/api/admin/users', {
      method: 'POST',
      body: {
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        password: form.password,
        role_id: form.role_id,
      },
    })
    setSaving(false)
    if (!ok) { addToast(message, 'error'); return }
    addToast(`${form.full_name.trim()} can now sign in.`)
    onClose()
    onAdded()
  }

  const selectedRole = roles.find(r => String(r.id) === String(form.role_id))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add an admin"
      description="They sign in with this email and password, and can change it afterwards in Settings."
      footer={
        <>
          <Button onClick={onClose} data-dialog-dismiss="true">Cancel</Button>
          <Button variant="primary" onClick={submit} busy={saving} busyLabel="Creating…">Create account</Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextField label="Full name" required value={form.full_name} error={errors.full_name}
          onChange={e => set('full_name', e.target.value)} placeholder="Sara Belkacem" />
        <TextField label="Email" type="email" required value={form.email} error={errors.email}
          onChange={e => set('email', e.target.value)} placeholder="sara@afaq.dz" />
        <TextField
          label="Temporary password" type="password" required
          hint="At least 8 characters. Share it with them directly."
          value={form.password} error={errors.password}
          onChange={e => set('password', e.target.value)}
        />
        <SelectField label="Role" required value={form.role_id} error={errors.role_id}
          onChange={e => set('role_id', e.target.value)}>
          {roles.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
        </SelectField>
        {selectedRole?.description && (
          <p className="text-xs -mt-2" style={{ color: 'var(--adm-silk-faint)' }}>{selectedRole.description}</p>
        )}
      </div>
    </Modal>
  )
}
