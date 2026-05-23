import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Check, X, Search } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import useAdminStore from '../store/adminStore'
import DataTable from '../components/ui/DataTable'
import EmptyState from '../components/ui/EmptyState'
import Skeleton from '../components/ui/Skeleton'

export default function MembershipPage() {
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const addToast = useAdminStore(s => s.addToast)

  useEffect(() => { loadApplications() }, [])

  const loadApplications = async () => {
    const { data } = await supabase.from('membership_applications').select('*').order('created_at', { ascending: false })
    setApplications(data || [])
    setLoading(false)
  }

  const [approving, setApproving] = useState({})

  const updateStatus = async (id, status) => {
    if (status === 'approved') {
      setApproving(prev => ({ ...prev, [id]: true }))
      setApplications(prev => prev.map(r => r.id === id ? { ...r, status: 'approved' } : r))
      fetch('/api/approve/membership', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      }).then(res => res.json()).then(data => {
        if (!data.ok) addToast(data.error || 'Failed to approve')
        else addToast('Application approved')
      }).catch(() => addToast('Failed to approve'))
      .finally(() => setApproving(prev => ({ ...prev, [id]: false })))
    } else {
      await supabase.from('membership_applications').update({ status }).eq('id', id)
      addToast(`Application ${status}`)
      loadApplications()
    }
  }

  const filtered = filter === 'all' ? applications : applications.filter(r => r.status === filter)

  const columns = [
    { header: 'Name', accessorKey: 'full_name', cell: ({ row }) => <span className="font-medium">{row.original.full_name}</span> },
    { header: 'Email', accessorKey: 'email' },
    { header: 'Student ID', accessorKey: 'student_id' },
    { header: 'Department', accessorKey: 'department' },
    { header: 'Status', accessorKey: 'status', cell: ({ row }) => {
      const s = row.original.status
      const colors = { pending: '#d97706', approved: '#16a34a', rejected: '#dc2626' }
      return <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: `${colors[s] || '#6b7280'}20`, color: colors[s] || '#6b7280' }}>{s}</span>
    }},
    { header: 'Date', accessorKey: 'created_at', cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString() },
    { header: '', id: 'actions', cell: ({ row }) => (
      <div className="flex gap-1">
        {row.original.status === 'pending' && (
          <>
            <button onClick={() => updateStatus(row.original.id, 'approved')} disabled={approving[row.original.id]} className="p-1.5 rounded-lg hover:opacity-70 disabled:opacity-30" style={{ color: '#16a34a' }}><Check size={14} /></button>
            <button onClick={() => updateStatus(row.original.id, 'rejected')} className="p-1.5 rounded-lg hover:opacity-70" style={{ color: '#dc2626' }}><X size={14} /></button>
          </>
        )}
      </div>
    )},
  ]

  if (loading) return <div className="space-y-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} style={{ height: 48 }} />)}</div>

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-2">
          {['all', 'pending', 'approved', 'rejected'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all"
              style={{
                background: filter === f ? 'var(--color-accent)' : 'var(--color-bg-alt)',
                color: filter === f ? '#fff' : 'var(--color-text-muted)',
              }}
            >
              {f === 'all' ? 'All' : f}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Search} title="No applications" description={filter === 'all' ? 'No membership applications yet' : `No ${filter} applications`} />
      ) : (
        <DataTable columns={columns} data={filtered} searchPlaceholder="Search applications..." />
      )}
    </motion.div>
  )
}
