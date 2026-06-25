import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Mail, Trash2, Eye, EyeOff } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import useAdminStore from '../store/adminStore'
import DataTable from '../components/ui/DataTable'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Skeleton from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'

export default function MessagesPage() {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const addToast = useAdminStore(s => s.addToast)

  useEffect(() => { loadMessages() }, [])

  const loadMessages = async () => {
    const { data } = await supabase.from('contact_messages').select('*').order('created_at', { ascending: false })
    setMessages(data || [])
    setLoading(false)
  }

  const toggleRead = async (msg) => {
    await supabase.from('contact_messages').update({ is_read: !msg.is_read }).eq('id', msg.id)
    loadMessages()
  }

  const handleDelete = async () => {
    await supabase.from('contact_messages').delete().eq('id', deleteId)
    addToast('Message deleted')
    setDeleteId(null)
    loadMessages()
  }

  const columns = [
    { header: 'Name', accessorKey: 'name', cell: ({ row }) => (
      <span className="font-medium" style={!row.original.is_read ? { color: 'var(--color-text)' } : { color: 'var(--color-text-muted)' }}>{row.original.name}</span>
    )},
    { header: 'Email', accessorKey: 'email' },
    { header: 'Subject', accessorKey: 'subject' },
    { header: 'Date', accessorKey: 'created_at', cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString() },
    { header: 'Status', accessorKey: 'is_read', cell: ({ row }) => (
      row.original.is_read
        ? <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: '#6b728020', color: '#6b7280' }}>Read</span>
        : <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: '#2460e720', color: '#2460e7' }}>New</span>
    )},
    { header: '', id: 'actions', cell: ({ row }) => (
      <div className="flex gap-1">
        <button onClick={() => setSelected(row.original)} className="admin-icon-btn p-1.5 rounded-lg" style={{ color: 'var(--color-text-muted)' }}><Eye size={14} /></button>
        <button onClick={() => toggleRead(row.original)} className="admin-icon-btn p-1.5 rounded-lg" style={{ color: 'var(--color-text-muted)' }}>{row.original.is_read ? <EyeOff size={14} /> : <Eye size={14} />}</button>
        <button onClick={() => setDeleteId(row.original.id)} className="admin-icon-btn p-1.5 rounded-lg" style={{ color: '#dc2626' }}><Trash2 size={14} /></button>
      </div>
    )},
  ]

  if (loading) return <div className="space-y-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} style={{ height: 48 }} />)}</div>

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>Contact form messages</p>

      {messages.length === 0 ? (
        <EmptyState icon={Mail} title="No messages yet" description="Messages from the contact form will appear here" />
      ) : (
        <DataTable columns={columns} data={messages} searchPlaceholder="Search messages..." />
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Message Details" size="md">
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Name</p>
                <p className="text-sm" style={{ color: 'var(--color-text)' }}>{selected.name}</p>
              </div>
              <div>
                <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Email</p>
                <p className="text-sm" style={{ color: 'var(--color-text)' }}>{selected.email}</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Subject</p>
              <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{selected.subject}</p>
            </div>
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Message</p>
              <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-text)' }}>{selected.message}</p>
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Date</p>
              <p className="text-sm" style={{ color: 'var(--color-text)' }}>{new Date(selected.created_at).toLocaleString()}</p>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Delete Message" message="Are you sure?" />
    </motion.div>
  )
}
