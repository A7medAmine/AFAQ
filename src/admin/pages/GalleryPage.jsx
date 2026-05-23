import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Edit3, Trash2, Upload, ImageIcon, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import useAdminStore from '../store/adminStore'
const getToken = () => useAdminStore.getState().session?.access_token
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Skeleton from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'

const spring = { type: 'spring', damping: 22, stiffness: 200 }

export default function GalleryPage() {
  const [albums, setAlbums] = useState([])
  const [loading, setLoading] = useState(true)
  const [albumModalOpen, setAlbumModalOpen] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [editing, setEditing] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [albumImages, setAlbumImages] = useState({})
  const [loadingImages, setLoadingImages] = useState({})
  const [uploading, setUploading] = useState(false)
  const addToast = useAdminStore(s => s.addToast)

  const [form, setForm] = useState({ title_en: '', title_ar: '', title_fr: '', description: '' })

  useEffect(() => { loadAlbums() }, [])

  const loadAlbums = async () => {
    const { data } = await supabase.from('gallery_albums').select('*').order('created_at', { ascending: false })
    setAlbums(data || [])
    setLoading(false)
  }

  const toggleExpand = async (albumId) => {
    if (expandedId === albumId) { setExpandedId(null); return }
    setExpandedId(albumId)
    if (!albumImages[albumId]) {
      setLoadingImages(p => ({ ...p, [albumId]: true }))
      const { data } = await supabase.from('gallery_images').select('*').eq('album_id', albumId).order('sort_order')
      setAlbumImages(p => ({ ...p, [albumId]: data || [] }))
      setLoadingImages(p => ({ ...p, [albumId]: false }))
    }
  }

  const openCreate = () => {
    setEditing(null)
    setForm({ title_en: '', title_ar: '', title_fr: '', description: '' })
    setAlbumModalOpen(true)
  }

  const openEdit = (a) => {
    setEditing(a)
    setForm({ title_en: a.title_en || '', title_ar: a.title_ar || '', title_fr: a.title_fr || '', description: a.description || '' })
    setAlbumModalOpen(true)
  }

  const handleSave = async () => {
    if (editing) {
      await supabase.from('gallery_albums').update(form).eq('id', editing.id)
      addToast('Album updated')
    } else {
      await supabase.from('gallery_albums').insert(form)
      addToast('Album created')
    }
    setAlbumModalOpen(false)
    loadAlbums()
  }

  const handleDelete = async () => {
    const { data: images } = await supabase.from('gallery_images').select('url').eq('album_id', deleteId)
    if (images) {
      for (const img of images) {
    await fetch('/api/upload', { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }, body: JSON.stringify({ url: img.url }) })
      }
    }
    await supabase.from('gallery_albums').delete().eq('id', deleteId)
    addToast('Album deleted')
    setDeleteId(null)
    setAlbumImages(p => { const { [deleteId]: _, ...rest } = p; return rest })
    loadAlbums()
  }

  const handleUpload = async (e) => {
    const files = e.target.files
    if (!files.length) return
    setUploading(true)
    for (const file of files) {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: fd })
      const { url } = await res.json()
      await supabase.from('gallery_images').insert({ album_id: expandedId, url })
    }
    setUploading(false)
    addToast(`${files.length} image(s) uploaded`)
    const { data } = await supabase.from('gallery_images').select('*').eq('album_id', expandedId).order('sort_order')
    setAlbumImages(p => ({ ...p, [expandedId]: data || [] }))
  }

  const deleteImage = async (img) => {
    await fetch('/api/upload', { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }, body: JSON.stringify({ url: img.url }) })
    await supabase.from('gallery_images').delete().eq('id', img.id)
    const { data } = await supabase.from('gallery_images').select('*').eq('album_id', expandedId).order('sort_order')
    setAlbumImages(p => ({ ...p, [expandedId]: data || [] }))
  }

  if (loading) return <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} style={{ height: 200 }} />)}</div>

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Manage gallery albums</p>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: 'var(--color-accent)' }}>
          <Plus size={16} /> New Album
        </button>
      </div>

      {albums.length === 0 ? (
        <EmptyState icon={ImageIcon} title="No albums yet" description="Create your first album" action={
          <button onClick={openCreate} className="mt-4 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: 'var(--color-accent)' }}>Create Album</button>
        } />
      ) : (
        <div className="space-y-5">
          {albums.map((album, idx) => {
            const isOpen = expandedId === album.id
            const images = albumImages[album.id] || []
            const imageCount = albumImages[album.id] ? images.length : '...'

            return (
              <motion.div
                key={album.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="rounded-2xl border overflow-hidden"
                style={{ background: 'var(--color-card)', borderColor: 'var(--color-border-light)' }}
              >
                {/* Album Header */}
                <div
                  onClick={() => toggleExpand(album.id)}
                  className="flex items-center justify-between p-4 cursor-pointer hover:opacity-80 transition-opacity"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl" style={{ background: 'var(--color-bg-alt)' }}>
                      <ImageIcon size={16} style={{ color: 'var(--color-accent)' }} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>{album.title_en}</h3>
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {album.description || 'No description'} &middot; {imageCount} image(s)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={(e) => { e.stopPropagation(); openEdit(album) }} className="p-2 rounded-xl hover:opacity-70" style={{ color: 'var(--color-text-muted)' }}><Edit3 size={14} /></button>
                    <button onClick={(e) => { e.stopPropagation(); setDeleteId(album.id) }} className="p-2 rounded-xl hover:opacity-70" style={{ color: '#dc2626' }}><Trash2 size={14} /></button>
                    {isOpen ? <ChevronUp size={18} style={{ color: 'var(--color-text-muted)' }} /> : <ChevronDown size={18} style={{ color: 'var(--color-text-muted)' }} />}
                  </div>
                </div>

                {/* Expanded Image Grid */}
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={spring}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 border-t" style={{ borderColor: 'var(--color-border-light)' }}>
                        {/* Upload bar */}
                        <label className="flex items-center justify-center gap-2 mt-4 p-4 rounded-xl border-2 border-dashed cursor-pointer transition-colors hover:opacity-80" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                          <Upload size={16} />
                          <span className="text-sm">{uploading ? 'Uploading...' : 'Click to upload images'}</span>
                          <input type="file" multiple accept="image/*" onChange={handleUpload} className="hidden" disabled={uploading} />
                        </label>

                        {/* Image grid */}
                        {loadingImages[album.id] ? (
                          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 mt-4">
                            {Array.from({ length: 6 }).map((_, i) => (
                              <Skeleton key={i} style={{ aspectRatio: '1', borderRadius: 12 }} />
                            ))}
                          </div>
                        ) : images.length === 0 ? (
                          <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>No images in this album yet</p>
                        ) : (
                          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 mt-4">
                            {images.map((img, i) => (
                              <motion.div
                                key={img.id}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: i * 0.03 }}
                                className="relative group rounded-xl overflow-hidden border"
                                style={{ borderColor: 'var(--color-border-light)', aspectRatio: '1' }}
                              >
                                <img src={img.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                                  <button
                                    onClick={() => deleteImage(img)}
                                    className="p-2 rounded-lg bg-white/90 text-red-600 opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Album CRUD Modal */}
      <Modal open={albumModalOpen} onClose={() => setAlbumModalOpen(false)} title={editing ? 'Edit Album' : 'Create Album'}>
        <div className="space-y-4">
          {['en', 'ar', 'fr'].map(lang => (
            <div key={lang}>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Title ({lang.toUpperCase()})</label>
              <input value={form[`title_${lang}`]} onChange={e => setForm({...form, [`title_${lang}`]: e.target.value})} className="w-full px-3 py-2 rounded-xl border text-sm" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border-light)', color: 'var(--color-text)' }} />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Description</label>
            <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={2} className="w-full px-3 py-2 rounded-xl border text-sm" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border-light)', color: 'var(--color-text)' }} />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t" style={{ borderColor: 'var(--color-border-light)' }}>
            <button onClick={() => setAlbumModalOpen(false)} className="px-4 py-2 rounded-xl text-sm font-medium border" style={{ borderColor: 'var(--color-border-light)', color: 'var(--color-text)' }}>Cancel</button>
            <button onClick={handleSave} className="px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: 'var(--color-accent)' }}>{editing ? 'Update' : 'Create'}</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Delete Album" message="This will delete the album and all its images permanently." />
    </motion.div>
  )
}
