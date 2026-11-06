import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronDown, Image as ImageIcon, ImageOff, Link2, Loader2, Pencil, Plus, Star, Trash2, Upload, X,
} from 'lucide-react'
import { api, deleteUploadedFile, read, run, supabase, uploadFile } from '../lib/db'
import useAdminStore from '../store/adminStore'
import useQueryParam from '../hooks/useQueryParam'
import { formatDate, plural, toForm } from '../lib/format'
import PageHeader from '../components/ui/PageHeader'
import Panel, { PanelHead } from '../components/ui/Panel'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import EmptyState, { ErrorState } from '../components/ui/EmptyState'
import Button, { IconButton } from '../components/ui/Button'
import Skeleton, { SkeletonPanel } from '../components/ui/Skeleton'
import { TextArea, TextField } from '../components/ui/Field'

const BLANK = { title_en: '', title_ar: '', title_fr: '', description: '' }

export default function GalleryPage() {
  const addToast = useAdminStore(s => s.addToast)

  const [albums, setAlbums] = useState([])
  const [imageCounts, setImageCounts] = useState({})
  const [state, setState] = useState({ loading: true, error: null })
  const [expanded, setExpanded] = useState(null)
  const [images, setImages] = useState({})
  const [loadingImages, setLoadingImages] = useState({})
  const [upload, setUpload] = useState(null)   // { file, percent, index, total }
  const [editor, setEditor] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [pendingImage, setPendingImage] = useState(null)
  const [newFlag, setNewFlag] = useQueryParam('new')

  const load = useCallback(async () => {
    setState(s => ({ ...s, error: null }))
    const [albumRes, countRes] = await Promise.all([
      read(supabase.from('gallery_albums').select('*').order('created_at', { ascending: false })),
      // Counting once up front replaces the per-album "…" that never resolved
      // until you opened the album.
      read(supabase.from('gallery_images').select('album_id')),
    ])

    if (!albumRes.ok) { setState({ loading: false, error: albumRes.message }); return }

    const tally = {}
    for (const row of countRes.data || []) tally[row.album_id] = (tally[row.album_id] || 0) + 1

    setAlbums(albumRes.data || [])
    setImageCounts(tally)
    setState({ loading: false, error: null })
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (newFlag) { setEditor({ album: null }); setNewFlag('') }
  }, [newFlag, setNewFlag])

  const loadImages = async albumId => {
    setLoadingImages(s => ({ ...s, [albumId]: true }))
    const { data } = await read(
      supabase.from('gallery_images').select('*').eq('album_id', albumId).order('sort_order')
    )
    setImages(s => ({ ...s, [albumId]: data || [] }))
    setLoadingImages(s => ({ ...s, [albumId]: false }))
  }

  const toggleAlbum = async albumId => {
    if (expanded === albumId) { setExpanded(null); return }
    setExpanded(albumId)
    if (!images[albumId]) await loadImages(albumId)
  }

  const uploadImages = async (albumId, files) => {
    const list = Array.from(files)
    if (!list.length) return

    let uploaded = 0
    for (let i = 0; i < list.length; i++) {
      const file = list[i]
      setUpload({ file: file.name, percent: 0, index: i + 1, total: list.length })
      try {
        const url = await uploadFile(file, percent => setUpload(u => (u ? { ...u, percent } : u)))
        const { ok } = await run(supabase.from('gallery_images').insert({ album_id: albumId, url }))
        if (ok) uploaded += 1
        else await deleteUploadedFile(url)   // don't leave an orphan on disk
      } catch (err) {
        addToast(`${file.name}: ${err.message}`, 'error')
      }
    }

    setUpload(null)
    if (uploaded) {
      addToast(`${plural(uploaded, 'image')} added.`)
      await loadImages(albumId)
      setImageCounts(c => ({ ...c, [albumId]: (c[albumId] || 0) + uploaded }))
    }
  }

  const removeImage = async () => {
    const { image, albumId } = pendingImage
    const { ok } = await run(
      supabase.from('gallery_images').delete().eq('id', image.id),
      { success: 'Image removed.', failure: 'The image was not removed.' }
    )
    if (!ok) return

    await deleteUploadedFile(image.url)
    setPendingImage(null)
    setImages(s => ({ ...s, [albumId]: (s[albumId] || []).filter(i => i.id !== image.id) }))
    setImageCounts(c => ({ ...c, [albumId]: Math.max(0, (c[albumId] || 1) - 1) }))
  }

  const setCover = async (album, url) => {
    const { ok } = await run(
      supabase.from('gallery_albums').update({ cover_url: url }).eq('id', album.id),
      { success: 'Album cover updated.', failure: 'The cover did not change.' }
    )
    if (ok) setAlbums(list => list.map(a => (a.id === album.id ? { ...a, cover_url: url } : a)))
  }

  const removeAlbum = async () => {
    const album = pendingDelete
    const { data: albumImages } = await read(
      supabase.from('gallery_images').select('url').eq('album_id', album.id)
    )

    const { ok } = await run(
      supabase.from('gallery_albums').delete().eq('id', album.id),
      { success: `“${album.title_en}” deleted.`, failure: 'The album was not deleted.' }
    )
    if (!ok) return

    // Rows cascade; the files on disk do not, so clear them too.
    await Promise.all((albumImages || []).map(i => deleteUploadedFile(i.url)))
    setPendingDelete(null)
    setExpanded(null)
    load()
  }

  return (
    <div>
      <PageHeader
        eyebrow="Publish"
        title="Gallery"
        description="Photo albums from club events and workshops, plus the image on the homepage intro."
        actions={<Button variant="primary" icon={Plus} onClick={() => setEditor({ album: null })}>New album</Button>}
      />

      <HomeIntroImage addToast={addToast} />

      <h2 className="text-[15px] mt-6 mb-3">Albums</h2>

      {state.error ? (
        <Panel><ErrorState message={state.error} onRetry={load} /></Panel>
      ) : state.loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonPanel key={i} rows={1} />)}
        </div>
      ) : albums.length === 0 ? (
        <Panel>
          <EmptyState
            icon={ImageIcon}
            title="No albums yet"
            description="Create an album for an event, then upload the photos into it."
            action={<Button variant="primary" icon={Plus} onClick={() => setEditor({ album: null })}>New album</Button>}
          />
        </Panel>
      ) : (
        <div className="space-y-3">
          {albums.map(album => {
            const isOpen = expanded === album.id
            const count = imageCounts[album.id] || 0
            const albumImages = images[album.id] || []

            return (
              <Panel key={album.id} className="overflow-hidden">
                <div className="flex items-center gap-3 p-4">
                  <button
                    type="button"
                    onClick={() => toggleAlbum(album.id)}
                    aria-expanded={isOpen}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                  >
                    {album.cover_url ? (
                      <img
                        src={album.cover_url}
                        alt=""
                        className="rounded-lg object-cover shrink-0"
                        style={{ width: 44, height: 44, border: '1px solid var(--adm-trace)' }}
                      />
                    ) : (
                      <span
                        className="flex items-center justify-center rounded-lg shrink-0"
                        style={{ width: 44, height: 44, background: 'var(--adm-board-sunk)', color: 'var(--adm-silk-faint)' }}
                        aria-hidden="true"
                      >
                        <ImageOff size={16} />
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold adm-truncate">{album.title_en}</span>
                      <span className="block text-xs adm-truncate" style={{ color: 'var(--adm-silk-faint)' }}>
                        {plural(count, 'photo')} · added {formatDate(album.created_at)}
                        {album.description ? ` · ${album.description}` : ''}
                      </span>
                    </span>
                  </button>

                  <div className="flex items-center gap-0.5 shrink-0">
                    <IconButton icon={Pencil} label="Rename album" onClick={() => setEditor({ album })} />
                    <IconButton icon={Trash2} label="Delete album" danger onClick={() => setPendingDelete(album)} />
                    <button
                      type="button"
                      onClick={() => toggleAlbum(album.id)}
                      className="adm-icon-btn"
                      aria-label={isOpen ? 'Hide photos' : 'Show photos'}
                    >
                      <ChevronDown
                        size={17}
                        style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .18s ease' }}
                      />
                    </button>
                  </div>
                </div>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div className="px-4 pb-4 pt-4" style={{ borderTop: '1px solid var(--adm-trace)' }}>
                        {upload ? (
                          <div className="p-4 rounded-xl" style={{ border: '1px solid var(--adm-trace)' }}>
                            <div className="flex items-center gap-2 mb-2.5">
                              <Loader2 size={15} className="adm-spin" style={{ color: 'var(--adm-signal)' }} />
                              <span className="text-sm adm-truncate flex-1">{upload.file}</span>
                              <span className="adm-data text-xs" style={{ color: 'var(--adm-silk-faint)' }}>
                                {upload.index} of {upload.total} · {upload.percent}%
                              </span>
                            </div>
                            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--adm-board-sunk)' }}>
                              <div
                                style={{
                                  width: `${upload.percent}%`, height: '100%',
                                  background: 'var(--adm-signal)', transition: 'width .2s ease',
                                }}
                              />
                            </div>
                          </div>
                        ) : (
                          <label
                            className="flex items-center justify-center gap-2 p-5 rounded-xl cursor-pointer text-sm"
                            style={{
                              border: '1.5px dashed var(--adm-trace-strong)',
                              color: 'var(--adm-silk-dim)',
                            }}
                          >
                            <Upload size={16} />
                            Add photos to this album
                            <input
                              type="file" multiple accept="image/*" className="sr-only"
                              onChange={e => { uploadImages(album.id, e.target.files); e.target.value = '' }}
                            />
                          </label>
                        )}

                        {loadingImages[album.id] ? (
                          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-7 gap-2.5 mt-4">
                            {Array.from({ length: 7 }).map((_, i) => (
                              <Skeleton key={i} style={{ aspectRatio: '1', height: 'auto', borderRadius: 10 }} />
                            ))}
                          </div>
                        ) : albumImages.length === 0 ? (
                          <p className="text-sm text-center py-8" style={{ color: 'var(--adm-silk-faint)' }}>
                            This album is empty. Add photos above.
                          </p>
                        ) : (
                          <ul className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-7 gap-2.5 mt-4">
                            {albumImages.map(image => {
                              const isCover = album.cover_url === image.url
                              return (
                                <li
                                  key={image.id}
                                  className="relative group rounded-lg overflow-hidden"
                                  style={{ aspectRatio: '1', border: '1px solid var(--adm-trace)' }}
                                >
                                  <img src={image.url} alt={image.alt_text || ''} className="w-full h-full object-cover" loading="lazy" />
                                  <div
                                    className="absolute inset-0 flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
                                    style={{ background: 'rgba(6,10,16,0.55)' }}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => setCover(album, image.url)}
                                      className="p-1.5 rounded-md"
                                      style={{ background: 'rgba(255,255,255,0.92)', color: isCover ? '#c97a04' : '#0a1220' }}
                                      aria-label={isCover ? 'This is the album cover' : 'Use as album cover'}
                                      title={isCover ? 'Album cover' : 'Use as album cover'}
                                    >
                                      <Star size={13} fill={isCover ? 'currentColor' : 'none'} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setPendingImage({ image, albumId: album.id })}
                                      className="p-1.5 rounded-md"
                                      style={{ background: 'rgba(255,255,255,0.92)', color: '#d8402f' }}
                                      aria-label="Delete photo"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                  {isCover && (
                                    <span
                                      className="absolute top-1 left-1 px-1.5 rounded text-[9px] adm-pixel uppercase tracking-wider"
                                      style={{ background: 'rgba(6,10,16,0.7)', color: '#fff' }}
                                    >
                                      Cover
                                    </span>
                                  )}
                                </li>
                              )
                            })}
                          </ul>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Panel>
            )
          })}
        </div>
      )}

      <AlbumEditor
        key={editor?.album?.id || 'new'}
        open={!!editor}
        album={editor?.album}
        onClose={() => setEditor(null)}
        onSaved={() => { setEditor(null); load() }}
      />

      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={removeAlbum}
        title="Delete this album?"
        message={
          pendingDelete
            ? `“${pendingDelete.title_en}” and its ${plural(imageCounts[pendingDelete.id] || 0, 'photo')} will be deleted permanently.`
            : ''
        }
        confirmLabel="Delete album"
      />

      <ConfirmDialog
        open={!!pendingImage}
        onClose={() => setPendingImage(null)}
        onConfirm={removeImage}
        title="Delete this photo?"
        message="The photo will be removed from the album and deleted from the server."
        confirmLabel="Delete photo"
      />
    </div>
  )
}

function AlbumEditor({ open, album, onClose, onSaved }) {
  const [form, setForm] = useState(BLANK)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(album ? toForm(BLANK, album) : BLANK)
    setErrors({})
  }, [open, album])

  const set = (key, value) => {
    setForm(f => ({ ...f, [key]: value }))
    setErrors(e => ({ ...e, [key]: undefined }))
  }

  const save = async () => {
    if (!form.title_en.trim()) {
      setErrors({ title_en: 'An English title is required — it is what the site shows.' })
      return
    }

    setSaving(true)
    const payload = {
      title_en: form.title_en.trim(),
      title_ar: form.title_ar?.trim() || null,
      title_fr: form.title_fr?.trim() || null,
      description: form.description?.trim() || null,
    }
    const { ok } = await run(
      album
        ? supabase.from('gallery_albums').update(payload).eq('id', album.id)
        : supabase.from('gallery_albums').insert(payload),
      {
        success: album ? 'Album updated.' : `“${payload.title_en}” created.`,
        failure: 'The album did not save.',
      }
    )
    setSaving(false)
    if (ok) onSaved()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={album ? 'Edit album' : 'New album'}
      description="Name the album after the event it covers."
      footer={
        <>
          <Button onClick={onClose} data-dialog-dismiss="true">Cancel</Button>
          <Button variant="primary" onClick={save} busy={saving} busyLabel="Saving…">
            {album ? 'Save changes' : 'Create album'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextField
          label="Title (English)" required
          value={form.title_en} error={errors.title_en}
          onChange={e => set('title_en', e.target.value)}
          placeholder="Robotics Day 2026"
        />
        <div className="grid sm:grid-cols-2 gap-4">
          <TextField label="Title (Arabic)" dir="rtl" value={form.title_ar || ''} onChange={e => set('title_ar', e.target.value)} />
          <TextField label="Title (French)" value={form.title_fr || ''} onChange={e => set('title_fr', e.target.value)} />
        </div>
        <TextArea
          label="Description" rows={2}
          value={form.description || ''}
          onChange={e => set('description', e.target.value)}
          placeholder="One line about what these photos show."
        />
      </div>
    </Modal>
  )
}

/** The single image on the homepage intro block. */
function HomeIntroImage({ addToast }) {
  const [image, setImage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [url, setUrl] = useState('')
  const [showUrl, setShowUrl] = useState(false)

  useEffect(() => {
    fetch('/api/page-content/home_intro')
      .then(r => r.json())
      .then(({ image_url }) => setImage(image_url || null))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const save = async next => {
    setSaving(true)
    const { ok, message } = await api('/api/page-content', {
      method: 'PUT',
      body: { section: 'home_intro', image_url: next },
    })
    setSaving(false)
    if (!ok) { addToast(message, 'error'); return }
    setImage(next)
    setUrl('')
    setShowUrl(false)
    addToast(next ? 'Homepage image updated.' : 'Homepage image removed.')
  }

  const upload = async file => {
    if (!file) return
    setSaving(true)
    try {
      const uploadedUrl = await uploadFile(file)
      await save(uploadedUrl)
    } catch (err) {
      addToast(err.message, 'error')
      setSaving(false)
    }
  }

  return (
    <Panel>
      <PanelHead
        eyebrow="Homepage"
        title="“Who are we” image"
        description="The photo beside the intro text on the homepage."
      />
      <div className="p-5">
        <div className="flex flex-col sm:flex-row gap-5">
          <div
            className="rounded-xl overflow-hidden shrink-0 relative"
            style={{ width: 'min(100%, 300px)', aspectRatio: '16/9', border: '1px solid var(--adm-trace)' }}
          >
            {loading ? (
              <Skeleton style={{ width: '100%', height: '100%', borderRadius: 0 }} />
            ) : image ? (
              <>
                <img src={image} alt="Homepage intro" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => save(null)}
                  disabled={saving}
                  className="absolute top-2 right-2 p-1.5 rounded-lg"
                  style={{ background: 'rgba(6,10,16,0.6)', color: '#fff' }}
                  aria-label="Remove homepage image"
                >
                  <X size={14} />
                </button>
              </>
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-xs"
                style={{ background: 'var(--adm-board-sunk)', color: 'var(--adm-silk-faint)' }}
              >
                No image set
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap gap-2">
              <label className="adm-btn" style={{ cursor: saving ? 'wait' : 'pointer' }}>
                {saving ? <Loader2 size={15} className="adm-spin" /> : <Upload size={15} />}
                {saving ? 'Working…' : 'Upload image'}
                <input
                  type="file" accept="image/*" className="sr-only" disabled={saving}
                  onChange={e => { upload(e.target.files?.[0]); e.target.value = '' }}
                />
              </label>
              <Button icon={Link2} onClick={() => setShowUrl(s => !s)}>
                {showUrl ? 'Cancel' : 'Use a link'}
              </Button>
            </div>

            {showUrl && (
              <div className="flex gap-2 mt-3">
                <input
                  className="adm-input"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="https://…"
                  aria-label="Image URL"
                />
                <Button variant="primary" onClick={() => save(url.trim())} disabled={!url.trim()} busy={saving} busyLabel="Saving…">
                  Save
                </Button>
              </div>
            )}

            <p className="text-xs mt-3" style={{ color: 'var(--adm-silk-faint)' }}>
              A wide photo works best — it is cropped to roughly 21:9.
            </p>
          </div>
        </div>
      </div>
    </Panel>
  )
}
