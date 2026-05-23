import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Plus, Edit3, Trash2, Upload, ImageIcon } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import useAdminStore from '../store/adminStore'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Skeleton from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'

export default function GalleryPage() {
  const [albums, setAlbums] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [editing, setEditing] = useState(null)
  const [albumImages, setAlbumImages] = useState([])
  const [imageModalOpen, setImageModalOpen] = useState(false)
  const [imageAlbumId, setImageAlbumId] = useState(null)
  const [uploading, setUploading] = useState(false)
  const addToast = useAdminStore(s => s.addToast)

  const [form, setForm] = useState({ title_en: '', title_ar: '', title_fr: '', description: '' })

  useEffect(() => { loadAlbums() }, [])

  const loadAlbums = async () => {
    const { data } = await supabase.from('gallery_albums').select('*').order('created_at', { ascending: false })
    setAlbums(data || [])
    setLoading(false)
  }

  const loadImages = async (albumId) => {
    const { data } = await supabase.from('gallery_images').select('*').eq('album_id', albumId).order('sort_order')
    setAlbumImages(data || [])
    setImageAlbumId(albumId)
    setImageModalOpen(true)
  }

  const openCreate = () => {
    setEditing(null)
    setForm({ title_en: '', title_ar: '', title_fr: '', description: '' })
    setModalOpen(true)
  }

  const openEdit = (a) => {
    setEditing(a)
    setForm({ title_en: a.title_en || '', title_ar: a.title_ar || '', title_fr: a.title_fr || '', description: a.description || '' })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (editing) {
      await supabase.from('gallery_albums').update(form).eq('id', editing.id)
      addToast('Album updated')
    } else {
      await supabase.from('gallery_albums').insert(form)
      addToast('Album created')
    }
    setModalOpen(false)
    loadAlbums()
  }

  const handleDelete = async () => {
    // Delete images from storage first
    const { data: images } = await supabase.from('gallery_images').select('url').eq('album_id', deleteId)
    if (images) {
      for (const img of images) {
        const path = img.url.split('/gallery/')[1]
        if (path) await supabase.storage.from('gallery').remove([path])
      }
    }
    await supabase.from('gallery_albums').delete().eq('id', deleteId)
    addToast('Album deleted')
    setDeleteId(null)
    loadAlbums()
  }

  const handleUpload = async (e) => {
    const files = e.target.files
    if (!files.length) return
    setUploading(true)
    for (const file of files) {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const { url } = await res.json()
      await supabase.from('gallery_images').insert({ album_id: imageAlbumId, url })
    }
    setUploading(false)
    addToast(`${files.length} image(s) uploaded`)
    loadImages(imageAlbumId)
  }

  const deleteImage = async (img) => {
    await fetch('/api/upload', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: img.url }) })
    await supabase.from('gallery_images').delete().eq('id', img.id)
    loadImages(imageAlbumId)
  }

  if (loading) return <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} style={{ height: 48 }} />)}</div>

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="flex items-center justify-between mb-6">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {albums.map(album => (
            <motion.div
              key={album.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border p-5 cursor-pointer hover:opacity-90 transition-opacity"
              style={{ background: 'var(--color-card)', borderColor: 'var(--color-border-light)' }}
              onClick={() => loadImages(album.id)}
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>{album.title_en}</h3>
                <div className="flex gap-1">
                  <button onClick={(e) => { e.stopPropagation(); openEdit(album) }} className="p-1 rounded hover:opacity-70" style={{ color: 'var(--color-text-muted)' }}><Edit3 size={12} /></button>
                  <button onClick={(e) => { e.stopPropagation(); setDeleteId(album.id) }} className="p-1 rounded hover:opacity-70" style={{ color: '#dc2626' }}><Trash2 size={12} /></button>
                </div>
              </div>
              {album.description && <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{album.description}</p>}
            </motion.div>
          ))}
        </div>
      )}

      {/* Album CRUD Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Album' : 'Create Album'}>
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
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-xl text-sm font-medium border" style={{ borderColor: 'var(--color-border-light)', color: 'var(--color-text)' }}>Cancel</button>
            <button onClick={handleSave} className="px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: 'var(--color-accent)' }}>{editing ? 'Update' : 'Create'}</button>
          </div>
        </div>
      </Modal>

      {/* Image Upload Modal */}
      <Modal open={imageModalOpen} onClose={() => setImageModalOpen(false)} title="Album Images" size="lg">
        <div className="space-y-4">
          <label className="flex items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed cursor-pointer" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
            <Upload size={18} />
            <span className="text-sm">{uploading ? 'Uploading...' : 'Click to upload images'}</span>
            <input type="file" multiple accept="image/*" onChange={handleUpload} className="hidden" disabled={uploading} />
          </label>

          {albumImages.length === 0 ? (
            <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-muted)' }}>No images in this album</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {albumImages.map(img => (
                <div key={img.id} className="relative group rounded-xl overflow-hidden border" style={{ borderColor: 'var(--color-border-light)' }}>
                  <img src={img.url} alt="" className="w-full h-32 object-cover" />
                  <button
                    onClick={() => deleteImage(img)}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Delete Album" message="This will delete the album and all its images permanently." />
    </motion.div>
  )
}
