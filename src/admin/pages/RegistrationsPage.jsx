import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Check, X, Download, Search, QrCode } from 'lucide-react'

import { supabase } from '../../lib/supabase'
import useAdminStore from '../store/adminStore'
import DataTable from '../components/ui/DataTable'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import Skeleton from '../components/ui/Skeleton'

export default function RegistrationsPage() {
  const [registrations, setRegistrations] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [qrModalReg, setQrModalReg] = useState(null)
  const addToast = useAdminStore(s => s.addToast)

  useEffect(() => { loadRegistrations() }, [])

  const loadRegistrations = async () => {
    const { data } = await supabase.from('event_registrations').select('*, event:events(title_en)').order('created_at', { ascending: false })
    setRegistrations(data || [])
    setLoading(false)
  }

  const [approving, setApproving] = useState({})

  const updateStatus = async (id, status) => {
    if (status === 'approved') {
      setApproving(prev => ({ ...prev, [id]: true }))
      setRegistrations(prev => prev.map(r => r.id === id ? { ...r, status: 'approved' } : r))
      fetch('/api/approve/registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      }).then(res => res.json()).then(data => {
        if (!data.ok) addToast(data.error || 'Failed to approve')
        else addToast('Registration approved')
      }).catch(() => addToast('Failed to approve'))
      .finally(() => setApproving(prev => ({ ...prev, [id]: false })))
    } else {
      await supabase.from('event_registrations').update({ status }).eq('id', id)
      addToast(`Registration ${status}`)
      loadRegistrations()
    }
  }

  const downloadQR = (dataUrl, name) => {
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `qr-${name.replace(/\s+/g, '-')}.png`
    a.click()
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
    { header: 'QR', id: 'qr', cell: ({ row }) => {
      const r = row.original
      if (r.status !== 'approved') return null
      return (
        <button onClick={() => setQrModalReg(r)} className="p-1.5 rounded-lg hover:opacity-70" style={{ color: 'var(--color-accent)' }} title="View QR Code">
          <QrCode size={14} />
        </button>
      )
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

      <Modal open={!!qrModalReg} onClose={() => setQrModalReg(null)} title="Registration QR Code" size="sm">
        {qrModalReg && qrModalReg.qr_code && (
          <div className="flex flex-col items-center gap-4">
            <img src={qrModalReg.qr_code} alt="QR Code" className="rounded-xl" style={{ width: 200, height: 200 }} />
            <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{qrModalReg.full_name}</p>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{qrModalReg.email}</p>
            <button onClick={() => downloadQR(qrModalReg.qr_code, qrModalReg.full_name)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: 'var(--color-accent)' }}>
              <Download size={14} /> Download QR
            </button>
          </div>
        )}
      </Modal>
    </motion.div>
  )
}
