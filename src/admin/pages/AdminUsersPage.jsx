import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Plus, Trash2, Shield } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import useAdminStore from '../store/adminStore'
import DataTable from '../components/ui/DataTable'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Skeleton from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'

export default function AdminUsersPage() {
  const [admins, setAdmins] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [saving, setSaving] = useState(false)
  const addToast = useAdminStore(s => s.addToast)

  const [form, setForm] = useState({ email: '', full_name: '', password: '', role_id: '' })

  useEffect(() => {
    Promise.all([
      supabase.from('admin_users').select('*, role:admin_roles(name, label)').order('created_at', { ascending: false }),
      supabase.from('admin_roles').select('*'),
    ]).then(([adminsRes, rolesRes]) => {
      setAdmins(adminsRes.data || [])
      setRoles(rolesRes.data || [])
      setLoading(false)
    })
  }, [])

  const openCreate = () => {
    setForm({ email: '', full_name: '', password: '', role_id: roles[0]?.id || '' })
    setModalOpen(true)
  }

  const session = useAdminStore(s => s.session)

  const handleCreate = async () => {
    if (form.password.length < 8) { addToast('Password must be at least 8 characters', 'error'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      addToast('Admin user created')
      setModalOpen(false)
      const { data: adminsData } = await supabase.from('admin_users').select('*, role:admin_roles(name, label)').order('created_at', { ascending: false })
      setAdmins(adminsData || [])
    } catch (err) {
      addToast(err.message, 'error')
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    const res = await fetch(`/api/admin/users/${deleteId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session?.access_token}` },
    })
    const data = await res.json()
    if (!res.ok) { addToast(data.error || 'Failed to delete', 'error'); return }
    addToast('Admin deleted')
    setDeleteId(null)
    const { data: adminsData } = await supabase.from('admin_users').select('*, role:admin_roles(name, label)').order('created_at', { ascending: false })
    setAdmins(adminsData || [])
  }

  const columns = [
    { header: 'Name', accessorKey: 'full_name', cell: ({ row }) => <span className="font-medium">{row.original.full_name || '-'}</span> },
    { header: 'Email', accessorKey: 'email' },
    { header: 'Role', accessorKey: 'role', cell: ({ row }) => (
      <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: '#2460e720', color: '#2460e7' }}>{row.original.role?.label}</span>
    )},
    { header: 'Status', accessorKey: 'is_active', cell: ({ row }) => (
      row.original.is_active
        ? <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: '#16a34a20', color: '#16a34a' }}>Active</span>
        : <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: '#dc262620', color: '#dc2626' }}>Inactive</span>
    )},
    { header: 'Created', accessorKey: 'created_at', cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString() },
    { header: '', id: 'actions', cell: ({ row }) => (
      <button onClick={() => setDeleteId(row.original.id)} className="admin-icon-btn p-1.5 rounded-lg" style={{ color: '#dc2626' }}><Trash2 size={14} /></button>
    )},
  ]

  if (loading) return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} style={{ height: 48 }} />)}</div>

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Manage admin accounts</p>
        <button onClick={openCreate} className="admin-btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: 'var(--color-accent)' }}>
          <Plus size={16} /> Add Admin
        </button>
      </div>

      {admins.length === 0 ? (
        <EmptyState icon={Shield} title="No admin users" action={
          <button onClick={openCreate} className="admin-btn-primary mt-4 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: 'var(--color-accent)' }}>Add Admin</button>
        } />
      ) : (
        <DataTable columns={columns} data={admins} searchable={false} />
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Admin User">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Full Name</label>
            <input value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} className="w-full px-3 py-2 rounded-xl border text-sm" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border-light)', color: 'var(--color-text)' }} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Email</label>
            <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full px-3 py-2 rounded-xl border text-sm" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border-light)', color: 'var(--color-text)' }} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Password</label>
            <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="w-full px-3 py-2 rounded-xl border text-sm" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border-light)', color: 'var(--color-text)' }} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Role</label>
            <select value={form.role_id} onChange={e => setForm({...form, role_id: e.target.value})} className="w-full px-3 py-2 rounded-xl border text-sm" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border-light)', color: 'var(--color-text)' }}>
              {roles.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t" style={{ borderColor: 'var(--color-border-light)' }}>
            <button onClick={() => setModalOpen(false)} className="admin-btn px-4 py-2 rounded-xl text-sm font-medium border" style={{ borderColor: 'var(--color-border-light)', color: 'var(--color-text)' }}>Cancel</button>
            <button onClick={handleCreate} disabled={saving} className="admin-btn-primary px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: 'var(--color-accent)' }}>
              {saving ? 'Creating...' : 'Create Admin'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Delete Admin" message="This will permanently remove this admin account." />
    </motion.div>
  )
}
