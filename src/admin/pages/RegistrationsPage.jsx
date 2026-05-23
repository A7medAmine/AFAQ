import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Check, X, Download, Search } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import useAdminStore from '../store/adminStore'
import DataTable from '../components/ui/DataTable'
import EmptyState from '../components/ui/EmptyState'
import Skeleton from '../components/ui/Skeleton'

export default function RegistrationsPage() {
  const [registrations, setRegistrations] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const addToast = useAdminStore(s => s.addToast)

  useEffect(() => { loadRegistrations() }, [])

  const loadRegistrations = async () => {
    const { data } = await supabase.from('event_registrations').select('*, event:events(title_en)').order('created_at', { ascending: false })
    setRegistrations(data || [])
    setLoading(false)
  }

  const updateStatus = async (id, status) => {
    await supabase.from('event_registrations').update({ status }).eq('id', id)
    addToast(`Registration ${status}`)
    loadRegistrations()
  }

  const exportCSV = () => {
    const headers = ['Full Name', 'Email', 'Phone', 'Department', 'Study Year', 'Skills', 'Interests', 'Motivation', 'Status', 'Date']
    const rows = filtered.map(r => [
      r.full_name, r.email, r.phone, r.department, r.study_year,
      (r.skills || []).join('; '), (r.interests || []).join('; '),
      r.motivation, r.status, r.created_at,
    ])
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v || ''}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'registrations.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const filtered = filter === 'all' ? registrations : registrations.filter(r => r.status === filter)

  const columns = [
    { header: 'Name', accessorKey: 'full_name', cell: ({ row }) => <span className="font-medium">{row.original.full_name}</span> },
    { header: 'Email', accessorKey: 'email' },
    { header: 'Department', accessorKey: 'department' },
    { header: 'Status', accessorKey: 'status', cell: ({ row }) => {
      const s = row.original.status
      const colors = { pending: '#d97706', approved: '#16a34a', rejected: '#dc2626', cancelled: '#6b7280' }
      return <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: `${colors[s] || '#6b7280'}20`, color: colors[s] || '#6b7280' }}>{s}</span>
    }},
    { header: 'Date', accessorKey: 'created_at', cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString() },
    { header: '', id: 'actions', cell: ({ row }) => (
      <div className="flex gap-1">
        {row.original.status === 'pending' && (
          <>
            <button onClick={() => updateStatus(row.original.id, 'approved')} className="p-1.5 rounded-lg hover:opacity-70" style={{ color: '#16a34a' }}><Check size={14} /></button>
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
          {['all', 'pending', 'approved', 'rejected', 'cancelled'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all"
              style={{
                background: filter === f ? 'var(--color-accent)' : 'var(--color-bg-alt)',
                color: filter === f ? '#fff' : 'var(--color-text-muted)',
              }}
            >{f}</button>
          ))}
        </div>
        <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border" style={{ borderColor: 'var(--color-border-light)', color: 'var(--color-text)' }}>
          <Download size={14} /> Export CSV
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Search} title="No registrations" description={filter === 'all' ? 'No registrations yet' : `No ${filter} registrations`} />
      ) : (
        <DataTable columns={columns} data={filtered} searchPlaceholder="Search registrations..." />
      )}
    </motion.div>
  )
}
