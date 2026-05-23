import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Plus, Edit3, Trash2, Pin, PinOff } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import useAdminStore from '../store/adminStore'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Skeleton from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const adminProfile = useAdminStore(s => s.adminProfile)
  const addToast = useAdminStore(s => s.addToast)

  const [form, setForm] = useState({
    title_en: '', title_ar: '', title_fr: '',
    content_en: '', content_ar: '', content_fr: '',
    is_pinned: false, is_published: true,
  })

  useEffect(() => { loadAnnouncements() }, [])

  const loadAnnouncements = async () => {
    const { data } = await supabase.from('announcements').select('*').order('is_pinned', { ascending: false }).order('created_at', { ascending: false })
    setAnnouncements(data || [])
    setLoading(false)
  }

  const openCreate = () => {
    setEditing(null)
    setForm({ title_en: '', title_ar: '', title_fr: '', content_en: '', content_ar: '', content_fr: '', is_pinned: false, is_published: true })
    setModalOpen(true)
  }

  const openEdit = (a) => {
    setEditing(a)
    setForm({
      title_en: a.title_en || '', title_ar: a.title_ar || '', title_fr: a.title_fr || '',
      content_en: a.content_en || '', content_ar: a.content_ar || '', content_fr: a.content_fr || '',
      is_pinned: a.is_pinned || false, is_published: a.is_published !== false,
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)
    const payload = { ...form, created_by: adminProfile?.user_id }
    if (editing) {
      await supabase.from('announcements').update(payload).eq('id', editing.id)
      addToast('Announcement updated')
    } else {
      await supabase.from('announcements').insert(payload)
      addToast('Announcement created')
    }
    setSaving(false)
    setModalOpen(false)
    loadAnnouncements()
  }

  const togglePin = async (a) => {
    await supabase.from('announcements').update({ is_pinned: !a.is_pinned }).eq('id', a.id)
    loadAnnouncements()
  }

  const handleDelete = async () => {
    await supabase.from('announcements').delete().eq('id', deleteId)
    addToast('Announcement deleted')
    setDeleteId(null)
    loadAnnouncements()
  }

  if (loading) return <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} style={{ height: 48 }} />)}</div>

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Club announcements</p>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: 'var(--color-accent)' }}>
          <Plus size={16} /> New Announcement
        </button>
      </div>

      {announcements.length === 0 ? (
        <EmptyState icon={Edit3} title="No announcements yet" action={
          <button onClick={openCreate} className="mt-4 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: 'var(--color-accent)' }}>Create Announcement</button>
        } />
      ) : (
        <div className="space-y-3">
          {announcements.map(a => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border p-5"
              style={{ background: 'var(--color-card)', borderColor: 'var(--color-border-light)' }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {a.is_pinned && <Pin size={12} style={{ color: 'var(--color-accent)' }} />}
                    <h3 className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>{a.title_en}</h3>
                    {!a.is_published && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#d9770620', color: '#d97706' }}>Draft</span>}
                  </div>
                  <p className="text-xs line-clamp-2" style={{ color: 'var(--color-text-muted)' }}>{a.content_en}</p>
                </div>
                <div className="flex gap-1 ml-4">
                  <button onClick={() => togglePin(a)} className="p-1.5 rounded-lg hover:opacity-70" style={{ color: 'var(--color-text-muted)' }}>
                    {a.is_pinned ? <PinOff size={14} /> : <Pin size={14} />}
                  </button>
                  <button onClick={() => openEdit(a)} className="p-1.5 rounded-lg hover:opacity-70" style={{ color: 'var(--color-text-muted)' }}><Edit3 size={14} /></button>
                  <button onClick={() => setDeleteId(a.id)} className="p-1.5 rounded-lg hover:opacity-70" style={{ color: '#dc2626' }}><Trash2 size={14} /></button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Announcement' : 'New Announcement'} size="lg">
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
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Content ({lang.toUpperCase()})</label>
                <textarea value={form[`content_${lang}`]} onChange={e => setForm({...form, [`content_${lang}`]: e.target.value})} rows={4} className="w-full px-3 py-2 rounded-xl border text-sm" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border-light)', color: 'var(--color-text)' }} />
              </div>
            ))}
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--color-text)' }}>
              <input type="checkbox" checked={form.is_pinned} onChange={e => setForm({...form, is_pinned: e.target.checked})} />
              Pinned
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

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Delete Announcement" message="Are you sure?" />
    </motion.div>
  )
}
