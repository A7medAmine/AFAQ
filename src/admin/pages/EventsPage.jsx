import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Plus, Edit3, Trash2, Eye, EyeOff, ToggleLeft, ToggleRight, Upload } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import useAdminStore from '../store/adminStore'
import DataTable from '../components/ui/DataTable'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Skeleton from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'

export default function EventsPage() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const adminProfile = useAdminStore(s => s.adminProfile)
  const addToast = useAdminStore(s => s.addToast)

  const [form, setForm] = useState({
    title_en: '', title_ar: '', title_fr: '',
    description_en: '', description_ar: '', description_fr: '',
    date: '', time: '',
    location_en: '', location_ar: '', location_fr: '',
    poster_url: '', max_participants: 0, registration_open: false, is_published: false,
  })

  const loadEvents = useCallback(async () => {
    const { data } = await supabase.from('events').select('*').order('date', { ascending: false })
    setEvents(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadEvents() }, [loadEvents])

  const openCreate = () => {
    setEditing(null)
    setForm({ title_en: '', title_ar: '', title_fr: '', description_en: '', description_ar: '', description_fr: '', date: '', time: '', location_en: '', location_ar: '', location_fr: '', poster_url: '', max_participants: 0, registration_open: false, is_published: false })
    setModalOpen(true)
  }

  const openEdit = (ev) => {
    setEditing(ev)
    setForm({
      title_en: ev.title_en || '', title_ar: ev.title_ar || '', title_fr: ev.title_fr || '',
      description_en: ev.description_en || '', description_ar: ev.description_ar || '', description_fr: ev.description_fr || '',
      date: ev.date || '', time: ev.time || '',
      location_en: ev.location_en || '', location_ar: ev.location_ar || '', location_fr: ev.location_fr || '',
      poster_url: ev.poster_url || '',
      max_participants: ev.max_participants || 0,
      registration_open: ev.registration_open || false,
      is_published: ev.is_published || false,
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)
    const payload = { ...form, created_by: adminProfile?.user_id }
    if (editing) {
      await supabase.from('events').update(payload).eq('id', editing.id)
      addToast('Event updated')
    } else {
      await supabase.from('events').insert(payload)
      addToast('Event created')
    }
    setSaving(false)
    setModalOpen(false)
    loadEvents()
  }

  const handleDelete = async () => {
    await supabase.from('events').delete().eq('id', deleteId)
    addToast('Event deleted')
    setDeleteId(null)
    loadEvents()
  }

  const togglePublish = async (ev) => {
    await supabase.from('events').update({ is_published: !ev.is_published }).eq('id', ev.id)
    loadEvents()
  }

  const toggleRegistration = async (ev) => {
    await supabase.from('events').update({ registration_open: !ev.registration_open }).eq('id', ev.id)
    loadEvents()
  }

  const columns = [
    { header: 'Title', accessorKey: 'title_en', cell: ({ row }) => (
      <span className="font-medium">{row.original.title_en}</span>
    )},
    { header: 'Date', accessorKey: 'date' },
    { header: 'Seats', accessorKey: 'max_participants' },
    { header: 'Registration', accessorKey: 'registration_open', cell: ({ row }) => (
      row.original.registration_open
        ? <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: '#16a34a20', color: '#16a34a' }}>Open</span>
        : <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: '#dc262620', color: '#dc2626' }}>Closed</span>
    )},
    { header: 'Status', accessorKey: 'is_published', cell: ({ row }) => (
      row.original.is_published
        ? <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: '#2460e720', color: '#2460e7' }}>Published</span>
        : <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: '#d9770620', color: '#d97706' }}>Draft</span>
    )},
    { header: '', id: 'actions', cell: ({ row }) => (
      <div className="flex gap-1">
        <button onClick={() => openEdit(row.original)} className="p-1.5 rounded-lg hover:opacity-70" style={{ color: 'var(--color-text-muted)' }}><Edit3 size={14} /></button>
        <button onClick={() => togglePublish(row.original)} className="p-1.5 rounded-lg hover:opacity-70" style={{ color: 'var(--color-text-muted)' }}>{row.original.is_published ? <EyeOff size={14} /> : <Eye size={14} />}</button>
        <button onClick={() => toggleRegistration(row.original)} className="p-1.5 rounded-lg hover:opacity-70" style={{ color: 'var(--color-text-muted)' }}>{row.original.registration_open ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}</button>
        <button onClick={() => setDeleteId(row.original.id)} className="p-1.5 rounded-lg hover:opacity-70" style={{ color: '#dc2626' }}><Trash2 size={14} /></button>
      </div>
    )},
  ]

  if (loading) return <div className="space-y-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} style={{ height: 48 }} />)}</div>

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Manage club events</p>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
          style={{ background: 'var(--color-accent)' }}
        >
          <Plus size={16} /> New Event
        </button>
      </div>

      {events.length === 0 ? (
        <EmptyState icon={Eye} title="No events yet" description="Create your first event to get started" action={
          <button onClick={openCreate} className="mt-4 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: 'var(--color-accent)' }}>Create Event</button>
        } />
      ) : (
        <DataTable columns={columns} data={events} searchPlaceholder="Search events..." />
      )}

      {/* Create/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Event' : 'Create Event'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {['en', 'ar', 'fr'].map(lang => (
              <div key={lang}>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Title ({lang.toUpperCase()})</label>
                <input value={form[`title_${lang}`]} onChange={e => setForm({...form, [`title_${lang}`]: e.target.value})} className="w-full px-3 py-2 rounded-xl border text-sm" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border-light)', color: 'var(--color-text)' }} />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {['en', 'ar', 'fr'].map(lang => (
              <div key={lang}>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Description ({lang.toUpperCase()})</label>
                <textarea value={form[`description_${lang}`]} onChange={e => setForm({...form, [`description_${lang}`]: e.target.value})} rows={3} className="w-full px-3 py-2 rounded-xl border text-sm" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border-light)', color: 'var(--color-text)' }} />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Date</label>
              <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="w-full px-3 py-2 rounded-xl border text-sm" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border-light)', color: 'var(--color-text)' }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Time</label>
              <input type="time" value={form.time} onChange={e => setForm({...form, time: e.target.value})} className="w-full px-3 py-2 rounded-xl border text-sm" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border-light)', color: 'var(--color-text)' }} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {['en', 'ar', 'fr'].map(lang => (
              <div key={lang}>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Location ({lang.toUpperCase()})</label>
                <input value={form[`location_${lang}`]} onChange={e => setForm({...form, [`location_${lang}`]: e.target.value})} className="w-full px-3 py-2 rounded-xl border text-sm" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border-light)', color: 'var(--color-text)' }} />
              </div>
            ))}
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Poster</label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm cursor-pointer" style={{ borderColor: 'var(--color-border-light)', color: 'var(--color-text-muted)' }}>
                <Upload size={14} /> Upload
                <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                  const fd = new FormData()
                  fd.append('file', e.target.files[0])
                  const res = await fetch('/api/upload', { method: 'POST', headers: { Authorization: `Bearer ${useAdminStore.getState().session?.access_token}` }, body: fd })
                  const { url } = await res.json()
                  setForm({...form, poster_url: url})
                }} />
              </label>
              {form.poster_url && (
                <div className="relative">
                  <img src={form.poster_url} alt="" className="w-16 h-16 object-cover rounded-lg border" style={{ borderColor: 'var(--color-border-light)' }} />
                  <button onClick={() => setForm({...form, poster_url: ''})} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">&times;</button>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Max Participants</label>
              <input type="number" value={form.max_participants} onChange={e => setForm({...form, max_participants: parseInt(e.target.value) || 0})} className="w-24 px-3 py-2 rounded-xl border text-sm" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border-light)', color: 'var(--color-text)' }} />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--color-text)' }}>
              <input type="checkbox" checked={form.registration_open} onChange={e => setForm({...form, registration_open: e.target.checked})} />
              Registration Open
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--color-text)' }}>
              <input type="checkbox" checked={form.is_published} onChange={e => setForm({...form, is_published: e.target.checked})} />
              Published
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t" style={{ borderColor: 'var(--color-border-light)' }}>
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-xl text-sm font-medium border" style={{ borderColor: 'var(--color-border-light)', color: 'var(--color-text)' }}>Cancel</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: 'var(--color-accent)' }}>
              {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Delete Event" message="Are you sure you want to delete this event? This action cannot be undone." />
    </motion.div>
  )
}
