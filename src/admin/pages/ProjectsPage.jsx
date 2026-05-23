import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Plus, Edit3, Trash2, Upload } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import useAdminStore from '../store/adminStore'
import DataTable from '../components/ui/DataTable'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Skeleton from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'

const categories = ['Arduino', 'Robotics', 'IoT', 'Electronics', 'Embedded Systems', 'AI']

export default function ProjectsPage() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const addToast = useAdminStore(s => s.addToast)

  const [form, setForm] = useState({
    title_en: '', title_ar: '', title_fr: '',
    description_en: '', description_ar: '', description_fr: '',
    category: '', technologies: [], github_url: '', demo_url: '',
    thumbnail_url: '', is_published: false,
  })
  const [techInput, setTechInput] = useState('')

  useEffect(() => { loadProjects() }, [])

  const loadProjects = async () => {
    const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: false })
    setProjects(data || [])
    setLoading(false)
  }

  const openCreate = () => {
    setEditing(null)
    setForm({ title_en: '', title_ar: '', title_fr: '', description_en: '', description_ar: '', description_fr: '', category: '', technologies: [], github_url: '', demo_url: '', thumbnail_url: '', is_published: false })
    setModalOpen(true)
  }

  const openEdit = (p) => {
    setEditing(p)
    setForm({
      title_en: p.title_en || '', title_ar: p.title_ar || '', title_fr: p.title_fr || '',
      description_en: p.description_en || '', description_ar: p.description_ar || '', description_fr: p.description_fr || '',
      category: p.category || '', technologies: p.technologies || [], github_url: p.github_url || '', demo_url: p.demo_url || '',
      thumbnail_url: p.thumbnail_url || '', is_published: p.is_published || false,
    })
    setModalOpen(true)
  }

  const addTech = () => {
    if (techInput.trim() && !form.technologies.includes(techInput.trim())) {
      setForm({ ...form, technologies: [...form.technologies, techInput.trim()] })
      setTechInput('')
    }
  }

  const removeTech = (t) => setForm({ ...form, technologies: form.technologies.filter(x => x !== t) })

  const handleSave = async () => {
    setSaving(true)
    if (editing) {
      await supabase.from('projects').update(form).eq('id', editing.id)
      addToast('Project updated')
    } else {
      await supabase.from('projects').insert(form)
      addToast('Project created')
    }
    setSaving(false)
    setModalOpen(false)
    loadProjects()
  }

  const handleDelete = async () => {
    await supabase.from('projects').delete().eq('id', deleteId)
    addToast('Project deleted')
    setDeleteId(null)
    loadProjects()
  }

  const columns = [
    { header: 'Title', accessorKey: 'title_en', cell: ({ row }) => <span className="font-medium">{row.original.title_en}</span> },
    { header: 'Category', accessorKey: 'category' },
    { header: 'Technologies', accessorKey: 'technologies', cell: ({ row }) => (
      <div className="flex gap-1 flex-wrap">
        {(row.original.technologies || []).slice(0, 3).map(t => (
          <span key={t} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--color-bg-alt)', color: 'var(--color-text-muted)' }}>{t}</span>
        ))}
      </div>
    )},
    { header: 'Status', accessorKey: 'is_published', cell: ({ row }) => (
      row.original.is_published
        ? <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: '#16a34a20', color: '#16a34a' }}>Published</span>
        : <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: '#d9770620', color: '#d97706' }}>Draft</span>
    )},
    { header: 'Created', accessorKey: 'created_at', cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString() },
    { header: '', id: 'actions', cell: ({ row }) => (
      <div className="flex gap-1">
        <button onClick={() => openEdit(row.original)} className="p-1.5 rounded-lg hover:opacity-70" style={{ color: 'var(--color-text-muted)' }}><Edit3 size={14} /></button>
        <button onClick={() => setDeleteId(row.original.id)} className="p-1.5 rounded-lg hover:opacity-70" style={{ color: '#dc2626' }}><Trash2 size={14} /></button>
      </div>
    )},
  ]

  if (loading) return <div className="space-y-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} style={{ height: 48 }} />)}</div>

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Manage club projects</p>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: 'var(--color-accent)' }}>
          <Plus size={16} /> New Project
        </button>
      </div>

      {projects.length === 0 ? (
        <EmptyState icon={Edit3} title="No projects yet" description="Create your first project" action={
          <button onClick={openCreate} className="mt-4 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: 'var(--color-accent)' }}>Create Project</button>
        } />
      ) : (
        <DataTable columns={columns} data={projects} searchPlaceholder="Search projects..." />
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Project' : 'Create Project'} size="lg">
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
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Category</label>
              <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full px-3 py-2 rounded-xl border text-sm" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border-light)', color: 'var(--color-text)' }}>
                <option value="">Select category</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Technologies</label>
              <div className="flex gap-2 mb-2 flex-wrap">
                {form.technologies.map(t => (
                  <span key={t} className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'var(--color-bg-alt)', color: 'var(--color-text)' }}>
                    {t}
                    <button onClick={() => removeTech(t)} className="hover:opacity-70">&times;</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={techInput} onChange={e => setTechInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTech())} placeholder="Add technology" className="flex-1 px-3 py-2 rounded-xl border text-sm" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border-light)', color: 'var(--color-text)' }} />
                <button onClick={addTech} className="px-3 py-2 rounded-xl text-sm border" style={{ borderColor: 'var(--color-border-light)', color: 'var(--color-text-muted)' }}>Add</button>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>GitHub URL</label>
              <input value={form.github_url} onChange={e => setForm({...form, github_url: e.target.value})} className="w-full px-3 py-2 rounded-xl border text-sm" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border-light)', color: 'var(--color-text)' }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Demo URL</label>
              <input value={form.demo_url} onChange={e => setForm({...form, demo_url: e.target.value})} className="w-full px-3 py-2 rounded-xl border text-sm" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border-light)', color: 'var(--color-text)' }} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Thumbnail</label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm cursor-pointer" style={{ borderColor: 'var(--color-border-light)', color: 'var(--color-text-muted)' }}>
                <Upload size={14} /> Upload
                <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                  const fd = new FormData()
                  fd.append('file', e.target.files[0])
                  const res = await fetch('/api/upload', { method: 'POST', body: fd })
                  const { url } = await res.json()
                  setForm({...form, thumbnail_url: url})
                }} />
              </label>
              {form.thumbnail_url && (
                <div className="relative">
                  <img src={form.thumbnail_url} alt="" className="w-16 h-16 object-cover rounded-lg border" style={{ borderColor: 'var(--color-border-light)' }} />
                  <button onClick={() => setForm({...form, thumbnail_url: ''})} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">&times;</button>
                </div>
              )}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--color-text)' }}>
            <input type="checkbox" checked={form.is_published} onChange={e => setForm({...form, is_published: e.target.checked})} />
            Published
          </label>
          <div className="flex justify-end gap-3 pt-4 border-t" style={{ borderColor: 'var(--color-border-light)' }}>
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-xl text-sm font-medium border" style={{ borderColor: 'var(--color-border-light)', color: 'var(--color-text)' }}>Cancel</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: 'var(--color-accent)' }}>
              {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Delete Project" message="Are you sure you want to delete this project?" />
    </motion.div>
  )
}
