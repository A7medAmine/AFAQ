import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft, ChevronLeft, ChevronRight, Download, FlipHorizontal2, FlipVertical2, FolderDown, Frame, ImagePlus, Images,
  RefreshCcw, RotateCcw, RotateCw, ScanFace, SlidersHorizontal, Trash2, Type, Upload, X,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { read, run, supabase, uploadFile, deleteUploadedFile } from '../lib/db'
import useAdminStore from '../store/adminStore'
import useQueryParam from '../hooks/useQueryParam'
import { CANVAS_SIZES, FORMATS, downloadZip, saveBlob } from '../lib/media'
import {
  BLUR_DEFAULTS, NEUTRAL_ADJUST, TEXT_DEFAULTS, canvasToPhoto, exportFrame, hitBlur, hitText, loadImage, loadLogoPath, placement,
  renderFrame, textsFor,
} from '../lib/frameRender'
import { DESIGNS, DESIGN_DEFAULTS, designOf } from '../lib/frameDesigns'
import { ensureFonts } from '../lib/frameFonts'
import PageHeader from '../components/ui/PageHeader'
import Panel, { PanelHead } from '../components/ui/Panel'
import Button, { IconButton } from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import { TextField } from '../components/ui/Field'
import TextLayersPanel from '../components/media/TextLayersPanel'
import FrameAdjustPanel from '../components/media/FrameAdjustPanel'
import FaceBlurPanel from '../components/media/FaceBlurPanel'
import DesignPicker from '../components/media/DesignPicker'
import { Segmented } from '../components/media/FrameControls'

const baseName = name => (name || 'photo').replace(/\.[^.]+$/, '')
// Frames added in the last week get a "new" tag in the picker.
const isNew = frame => Date.now() - new Date(frame.created_at) < 7 * 24 * 3600 * 1000
let nextId = 1
let nextTextId = 1
let nextBlurId = 1
const newText = extra => ({ ...TEXT_DEFAULTS, ...extra, id: `t${Date.now().toString(36)}${nextTextId++}` })

// The side tools, one tab at a time. `key` switches to the tab from the keyboard.
const TOOL_TABS = [
  { value: 'frame', label: 'Frame', icon: Frame, key: 'F' },
  { value: 'text', label: 'Text', icon: Type, key: 'T' },
  { value: 'edit', label: 'Edit', icon: SlidersHorizontal, key: 'E' },
  { value: 'blur', label: 'Blur', icon: ScanFace, key: 'B' },
]

const DESIGN_PREFIX = 'design:'
const designKeyOf = id => (String(id).startsWith(DESIGN_PREFIX) ? String(id).slice(DESIGN_PREFIX.length) : null)

// Sample words the designs come with. Leaving a design drops its layers that
// still say one of these; anything typed over them stays.
const SAMPLE_TEXTS = new Set(DESIGNS.flatMap(d => d.texts({ width: 1080, height: 1350 }).map(t => t.text)))

/**
 * Swap the design-seeded layers of one scope ('all', or a photo with its own
 * frame) for another design's, keeping words already typed per role. A photo
 * getting its own design starts from the words typed for the shared one.
 */
function reseed(texts, key, dims, scope = 'all') {
  const mine = t => t.role && t.scope === scope
  const typed = {}
  for (const t of texts) if (mine(t) && !SAMPLE_TEXTS.has(t.text)) typed[t.role] ??= t.text
  if (scope !== 'all') for (const t of texts) if (t.role && t.scope === 'all' && !SAMPLE_TEXTS.has(t.text)) typed[t.role] ??= t.text
  const kept = texts.filter(t => !mine(t))
  if (!key) {
    // Back to a plain frame: keep what was typed as ordinary layers.
    return [...kept, ...texts.filter(t => mine(t) && !SAMPLE_TEXTS.has(t.text)).map(t => ({ ...t, role: undefined }))]
  }
  return [...kept, ...designOf(key).texts(dims).map(s => newText({ ...s, scope, text: typed[s.role] ?? s.text }))]
}

// Text, look and design choices survive a reload on this device; photos don't.
const STORE_KEY = 'afaq.frameStudio'
function loadSaved() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) || {}
  } catch {
    return {}
  }
}

/**
 * Put the club's frames on photos in bulk. Drop in a shoot, pick a size and a
 * frame (an uploaded PNG or a built-in design), edit the look, add text, nudge
 * each photo into place, and download them all — or save them straight to a
 * planner post as its final versions. Everything is drawn in the browser;
 * nothing is uploaded until you save to a post.
 */
export default function FrameStudioPage() {
  const adminId = useAdminStore(s => s.adminProfile?.id)
  const addToast = useAdminStore(s => s.addToast)
  const [postId] = useQueryParam('post', '')

  const [saved] = useState(loadSaved)
  const [post, setPost] = useState(null)
  const [frames, setFrames] = useState([])
  const [frameImages, setFrameImages] = useState({}) // id → HTMLImageElement
  const [size, setSize] = useState('post')
  const [frameBySize, setFrameBySize] = useState(saved.frameBySize || {}) // size → frame id | 'none' | 'design:<key>'
  const [photos, setPhotos] = useState([]) // { id, name, img, zoom, x, y, rotate, flipX, flipY, adjust? }
  const [current, setCurrent] = useState(0)
  const [adjust, setAdjust] = useState({ ...NEUTRAL_ADJUST, ...saved.adjust })
  const [texts, setTexts] = useState(() => (saved.texts || []).filter(t => t.scope === 'all').map(t => newText(t)))
  const [selected, setSelected] = useState(null) // text layer id
  const [selectedBlur, setSelectedBlur] = useState(null) // face blur id on the current photo
  const [tool, setTool] = useState('frame') // which side tab is open
  const [design, setDesign] = useState({ ...DESIGN_DEFAULTS, ...saved.design })
  const [frameTab, setFrameTab] = useState(designKeyOf(saved.frameBySize?.post) ? 'designs' : 'club')
  const [logoPath, setLogoPath] = useState(null)
  const [fontTick, setFontTick] = useState(0)
  const [fit, setFit] = useState('cover')
  const [format, setFormat] = useState('jpeg')
  const [busy, setBusy] = useState(null) // 'zip' | 'save' | 'load' | 'frame'
  const [manage, setManage] = useState(false)
  const [newFrameName, setNewFrameName] = useState('')

  const canvasRef = useRef(null)
  const fileInput = useRef(null)
  const frameInput = useRef(null)
  const drag = useRef(null)

  const { width, height } = CANVAS_SIZES[size]
  const sizeFrames = useMemo(() => frames.filter(f => f.size === size), [frames, size])
  const sharedFrameId = frameBySize[size] ?? sizeFrames[0]?.id ?? 'none'

  /** A photo's own frame, when it has one that exists at this size; null means it follows the shared one. */
  const ownFrameOf = ph => {
    const own = ph?.frame
    if (own == null) return null
    return own === 'none' || designKeyOf(own) || sizeFrames.some(f => f.id === own) ? own : null
  }

  /** What a photo is drawn with: its own frame and design colours, or the shared ones. */
  const lookOf = ph => {
    const own = ownFrameOf(ph)
    const id = own ?? sharedFrameId
    const key = designKeyOf(id)
    return {
      photo: ph ? { ...ph, frame: own ?? undefined } : null,
      frame: key || id === 'none' ? null : frameImages[id] || null,
      design: key ? { key, ...((own != null && ph.design) || design) } : null,
    }
  }

  const photo = photos[current] || null
  const ownFrame = ownFrameOf(photo)
  const frameMode = ownFrame != null ? 'one' : 'all'
  const frameId = ownFrame ?? sharedFrameId
  const designKey = designKeyOf(frameId)
  const designOptions = (ownFrame != null && photo.design) || design
  const look = useMemo(() => lookOf(photo), [photo, sharedFrameId, frameImages, design, sizeFrames]) // eslint-disable-line react-hooks/exhaustive-deps
  const visibleTexts = useMemo(() => textsFor(texts, look.photo), [texts, look])

  // ---- loading ----

  const loadFrames = useCallback(async () => {
    // Newest first, so a frame just uploaded is the first one in the picker.
    const { data } = await read(supabase.from('media_frames').select('*').eq('is_active', true)
      .order('created_at', { ascending: false }).order('id', { ascending: false }))
    setFrames(data || [])
  }, [])

  useEffect(() => { loadFrames() }, [loadFrames])
  useEffect(() => { loadLogoPath().then(setLogoPath) }, [])

  // Frames load once each; a failed one just doesn't show.
  useEffect(() => {
    frames.forEach(f => {
      if (frameImages[f.id]) return
      loadImage(f.url).then(img => setFrameImages(m => ({ ...m, [f.id]: img })), () => {})
    })
  }, [frames]) // eslint-disable-line react-hooks/exhaustive-deps

  // Redraw once the faces the text uses have loaded.
  const fontKey = texts.map(t => `${t.font}:${t.weight}`).join('|')
  useEffect(() => {
    let live = true
    ensureFonts(texts).then(() => live && setFontTick(n => n + 1))
    return () => { live = false }
  }, [fontKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        texts: texts.filter(t => t.scope === 'all'), adjust, design, frameBySize,
      }))
    } catch { /* private window or full storage: nothing to keep */ }
  }, [texts, adjust, design, frameBySize])

  // A design lays its words out for one canvas shape; follow it to the new size.
  const lastSize = useRef(size)
  useEffect(() => {
    if (lastSize.current === size) return
    lastSize.current = size
    setTexts(ts => ts.map(t => {
      if (!t.role) return t
      const key = designKeyOf(t.scope === 'all' ? sharedFrameId : photos.find(p => p.id === t.scope)?.frame)
      const s = key && designOf(key).texts({ width, height }).find(x => x.role === t.role)
      return s ? { ...t, x: s.x, y: s.y } : t
    }))
  }, [size]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!postId) { setPost(null); return }
    read(supabase.from('media_posts').select('id, title, format, assets:media_assets(id, kind, url, file_name)').eq('id', postId).maybeSingle())
      .then(({ data }) => {
        setPost(data || null)
        const fmt = FORMATS.find(f => f.value === data?.format)
        if (fmt) setSize(fmt.size)
      })
  }, [postId])

  const addFiles = async files => {
    const list = [...files].filter(f => f.type.startsWith('image/'))
    if (!list.length) return
    setBusy('load')
    const loaded = []
    for (const file of list) {
      try {
        const img = await loadImage(URL.createObjectURL(file))
        loaded.push({ id: nextId++, name: file.name, img, zoom: 1, x: 0, y: 0, rotate: 0 })
      } catch {
        addToast(`${file.name} could not be opened.`, 'error')
      }
    }
    setPhotos(p => {
      if (!p.length) setCurrent(0)
      return [...p, ...loaded]
    })
    setBusy(null)
  }

  const addFromPost = async () => {
    const raws = (post?.assets || []).filter(a => a.kind === 'raw')
    if (!raws.length) { addToast('This post has no raw photos yet.', 'error'); return }
    setBusy('load')
    const loaded = []
    for (const a of raws) {
      try {
        const img = await loadImage(a.url)
        loaded.push({ id: nextId++, name: a.file_name || `photo-${a.id}.jpg`, img, zoom: 1, x: 0, y: 0, rotate: 0 })
      } catch {
        addToast(`${a.file_name || 'A photo'} could not be loaded.`, 'error')
      }
    }
    setPhotos(p => [...p, ...loaded])
    setBusy(null)
  }

  const removePhoto = index => {
    setPhotos(p => {
      const gone = p[index]
      if (gone?.img?.src.startsWith('blob:')) URL.revokeObjectURL(gone.img.src)
      return p.filter((_, i) => i !== index)
    })
    // Text that was only for that photo goes with it.
    const goneId = photos[index]?.id
    setTexts(ts => ts.filter(t => t.scope !== goneId))
    setCurrent(c => Math.max(0, c >= index ? c - 1 : c))
  }

  // ---- preview ----

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = width
    canvas.height = height
    const id = requestAnimationFrame(() => {
      renderFrame(canvas.getContext('2d'), {
        width, height, ...look, logoPath, texts, adjust, fit, selected, selectedBlur: tool === 'blur' ? selectedBlur : null,
      })
    })
    return () => cancelAnimationFrame(id)
  }, [look, logoPath, texts, selected, selectedBlur, tool, adjust, fit, width, height, fontTick])

  const updatePhoto = patch => setPhotos(p => p.map((ph, i) => (i === current ? { ...ph, ...patch } : ph)))
  const updateBlur = (id, patch) => setPhotos(p => p.map((ph, i) => (i === current
    ? { ...ph, blurs: (ph.blurs || []).map(b => (b.id === id ? { ...b, ...patch } : b)) } : ph)))
  const removeBlur = id => {
    setPhotos(p => p.map((ph, i) => (i === current ? { ...ph, blurs: (ph.blurs || []).filter(b => b.id !== id) } : ph)))
    setSelectedBlur(null)
  }
  const updateText = (id, patch) => setTexts(ts => ts.map(t => (t.id === id ? { ...t, ...patch } : t)))

  const addText = extra => {
    // Stagger new layers so they don't land exactly on top of each other.
    const t = newText({ y: Math.min(0.85, 0.3 + (texts.length % 6) * 0.1), ...extra })
    setTexts(ts => [...ts, t])
    setSelected(t.id)
  }

  const removeText = id => {
    setTexts(ts => ts.filter(t => t.id !== id))
    setSelected(null)
  }

  const pickFrame = id => {
    const key = designKeyOf(id)
    if (frameMode === 'one') {
      updatePhoto({ frame: id })
      if (key !== designKey) setTexts(ts => reseed(ts, key, { width, height }, photo.id))
    } else {
      setFrameBySize(m => ({ ...m, [size]: id }))
      if (key !== designKey) setTexts(ts => reseed(ts, key, { width, height }))
    }
    setSelected(null)
  }

  const setDesignOptions = fn => {
    if (frameMode === 'one') setPhotos(p => p.map((ph, i) => (i === current ? { ...ph, design: fn(ph.design || design) } : ph)))
    else setDesign(fn)
  }

  /** Give the current photo its own frame (starting from the shared one), or put it back on the shared one. */
  const setFrameMode = mode => {
    if (!photo || mode === frameMode) return
    const dims = { width, height }
    if (mode === 'one') {
      updatePhoto({ frame: sharedFrameId, design: { ...design } })
      setTexts(ts => reseed(ts, designKeyOf(sharedFrameId), dims, photo.id))
    } else {
      updatePhoto({ frame: undefined, design: undefined })
      setTexts(ts => reseed(ts, null, dims, photo.id))
    }
    setSelected(null)
  }

  /** Make this photo's own frame the shared one, for every photo that has no frame of its own. */
  const shareThisFrame = () => {
    setFrameBySize(m => ({ ...m, [size]: ownFrame }))
    if (photo.design) setDesign(photo.design)
    // This photo's design words replace the shared ones.
    setTexts(ts => ts
      .filter(t => !(t.role && t.scope === 'all'))
      .map(t => (t.role && t.scope === photo.id ? { ...t, scope: 'all' } : t)))
    updatePhoto({ frame: undefined, design: undefined })
    setSelected(null)
  }

  /** Canvas pixel under the pointer. */
  const pointOf = e => {
    const rect = canvasRef.current.getBoundingClientRect()
    return {
      px: ((e.clientX - rect.left) * width) / rect.width,
      py: ((e.clientY - rect.top) * height) / rect.height,
      ratio: width / rect.width,
    }
  }
  const textAt = e => {
    const { px, py } = pointOf(e)
    const ctx = canvasRef.current.getContext('2d')
    return [...visibleTexts].reverse().find(t => hitText(ctx, t, width, height, px, py)) || null
  }

  /** The pointer on the current photo, as fractions of the image (see canvasToPhoto). */
  const photoPointOf = e => {
    const { px, py } = pointOf(e)
    return canvasToPhoto(photo, placement(photo.img, width, height, photo, fit), px, py)
  }
  const blurAt = at => [...(photo?.blurs || [])].reverse().find(b => hitBlur(b, at)) || null

  const onPointerDown = e => {
    e.currentTarget.setPointerCapture(e.pointerId)
    const { ratio } = pointOf(e)
    // In the blur tool a click picks up a blur, or drops a new one on the face under it.
    if (tool === 'blur' && photo) {
      const at = photoPointOf(e)
      const hit = blurAt(at)
      if (hit) {
        setSelectedBlur(hit.id)
        drag.current = { blur: hit.id, dx: at.x - hit.x, dy: at.y - hit.y }
        return
      }
      if (at.x < 0 || at.x > 1 || at.y < 0 || at.y > 1) { setSelectedBlur(null); return }
      const b = { ...BLUR_DEFAULTS, id: `b${nextBlurId++}`, x: at.x, y: at.y }
      updatePhoto({ blurs: [...(photo.blurs || []), b] })
      setSelectedBlur(b.id)
      drag.current = { blur: b.id, dx: 0, dy: 0 }
      return
    }
    const hit = textAt(e)
    if (hit) {
      setSelected(hit.id)
      setTool('text')
      drag.current = { text: hit.id, sx: e.clientX, sy: e.clientY, x: hit.x, y: hit.y, ratio }
      return
    }
    setSelected(null)
    if (!photo) return
    drag.current = { sx: e.clientX, sy: e.clientY, x: photo.x, y: photo.y, ratio }
  }
  const onPointerMove = e => {
    if (!drag.current) return
    const d = drag.current
    if (d.blur) {
      const at = photoPointOf(e)
      updateBlur(d.blur, { x: at.x - d.dx, y: at.y - d.dy })
      return
    }
    const nx = d.x + ((e.clientX - d.sx) * d.ratio) / width
    const ny = d.y + ((e.clientY - d.sy) * d.ratio) / height
    if (d.text) {
      // Snap to the middle lines, where most titles want to sit.
      const snap = v => (Math.abs(v - 0.5) < 0.012 ? 0.5 : Math.min(1, Math.max(0, v)))
      updateText(d.text, { x: snap(nx), y: snap(ny) })
      return
    }
    if (!photo) return
    // Store the clamped pan so dragging past an edge doesn't build up slack.
    const p = placement(photo.img, width, height, { zoom: photo.zoom, x: nx, y: ny, rotate: photo.rotate }, fit)
    updatePhoto({ x: p.ox / width, y: p.oy / height })
  }
  const onPointerUp = () => { drag.current = null }
  const onWheel = e => {
    // Over a blur in the blur tool, the wheel resizes that blur.
    const blur = tool === 'blur' && photo && blurAt(photoPointOf(e))
    if (blur) {
      e.preventDefault()
      setSelectedBlur(blur.id)
      updateBlur(blur.id, { size: Math.min(0.4, Math.max(0.02, blur.size * (e.deltaY < 0 ? 1.06 : 1 / 1.06))) })
      return
    }
    // Over the selected text, the wheel resizes it; anywhere else it zooms the photo.
    const hit = selected && textAt(e)
    if (hit?.id === selected) {
      e.preventDefault()
      updateText(hit.id, { size: Math.min(400, Math.max(8, hit.size * (e.deltaY < 0 ? 1.05 : 1 / 1.05))) })
      return
    }
    if (!photo) return
    e.preventDefault()
    const zoom = Math.min(4, Math.max(fit === 'cover' ? 1 : 0.3, photo.zoom * (e.deltaY < 0 ? 1.06 : 1 / 1.06)))
    updatePhoto({ zoom })
  }

  // React's onWheel is passive, so preventDefault needs a native listener.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  })

  // Re-bound each render so it sees the current layers.
  useEffect(() => {
    const onKey = e => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return
      if (tool === 'blur' && selectedBlur && photo?.blurs?.some(b => b.id === selectedBlur)) {
        if (e.key === 'Delete' || e.key === 'Backspace') { removeBlur(selectedBlur); return }
        if (e.key === 'Escape') { setSelectedBlur(null); return }
      }
      const layer = selected && texts.find(t => t.id === selected)
      if (layer) {
        const step = e.shiftKey ? 0.02 : 0.004
        const nudge = { ArrowRight: [step, 0], ArrowLeft: [-step, 0], ArrowDown: [0, step], ArrowUp: [0, -step] }[e.key]
        if (nudge) {
          e.preventDefault()
          updateText(layer.id, { x: layer.x + nudge[0], y: layer.y + nudge[1] })
          return
        }
        if (e.key === 'Delete' || e.key === 'Backspace') { removeText(layer.id); return }
        if (e.key === 'Escape') { setSelected(null); return }
      }
      const tab = !e.ctrlKey && !e.metaKey && !e.altKey && TOOL_TABS.find(t => t.key === e.key.toUpperCase())
      if (tab) { setTool(tab.value); return }
      if (e.key === 'ArrowRight') setCurrent(c => Math.min(photos.length - 1, c + 1))
      if (e.key === 'ArrowLeft') setCurrent(c => Math.max(0, c - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // ---- export ----

  const mime = format === 'png' ? 'image/png' : 'image/jpeg'
  const ext = format === 'png' ? 'png' : 'jpg'
  const outName = ph => `${baseName(ph.name)}-${size}.${ext}`
  const render = async ph => {
    await ensureFonts(texts)
    return exportFrame({ width, height, ...lookOf(ph), logoPath, texts, adjust, fit }, mime)
  }

  const downloadOne = async () => {
    if (!photo) return
    try {
      saveBlob(await render(photo), outName(photo))
    } catch (err) {
      addToast(err.message, 'error')
    }
  }

  const downloadAll = async () => {
    setBusy('zip')
    try {
      const files = []
      for (const ph of photos) files.push({ name: outName(ph), blob: await render(ph) })
      await downloadZip(files, `afaq-${size}-${new Date().toISOString().slice(0, 10)}.zip`)
    } catch (err) {
      addToast(err.message || 'The zip could not be made.', 'error')
    }
    setBusy(null)
  }

  const saveToPost = async () => {
    if (!post) return
    setBusy('save')
    let saved = 0
    for (const ph of photos) {
      try {
        const blob = await render(ph)
        const url = await uploadFile(new File([blob], outName(ph), { type: mime }))
        const { ok } = await run(supabase.from('media_assets').insert({
          post_id: post.id, kind: 'final', url, file_name: outName(ph), uploaded_by: adminId,
        }))
        if (ok) saved += 1
      } catch (err) {
        addToast(`${ph.name}: ${err.message}`, 'error')
      }
    }
    setBusy(null)
    if (saved) addToast(`${saved} final${saved === 1 ? '' : 's'} saved to “${post.title}”.`)
  }

  // ---- frame management ----

  /**
   * Upload one or more frame PNGs. Each goes to the canvas size its shape
   * matches, whatever size is open, so a mixed batch sorts itself.
   */
  const uploadFrames = async fileList => {
    const files = [...(fileList || [])]
    if (!files.length) return
    setBusy('frame')
    const added = {} // size → count
    for (const file of files) {
      if (file.type !== 'image/png') { addToast(`${file.name}: frames must be transparent PNG files.`, 'error'); continue }
      try {
        const img = await loadImage(URL.createObjectURL(file))
        const ratio = img.naturalWidth / img.naturalHeight
        const match = Object.entries(CANVAS_SIZES).find(([, s]) => Math.abs(ratio - s.width / s.height) < 0.02)?.[0]
        if (!match) {
          const known = Object.values(CANVAS_SIZES).map(s => `${s.width}×${s.height}`).join(', ')
          addToast(`${file.name} is ${img.naturalWidth}×${img.naturalHeight}; frames must be ${known}.`, 'error')
          continue
        }
        const url = await uploadFile(file)
        const name = (files.length === 1 && newFrameName.trim()) || baseName(file.name)
        const { ok } = await run(supabase.from('media_frames').insert({ name, size: match, url, sort_order: 100 }),
          { failure: `${file.name} did not save.` })
        if (ok) added[match] = (added[match] || 0) + 1
      } catch (err) {
        addToast(`${file.name}: ${err.message}`, 'error')
      }
    }
    setBusy(null)
    const total = Object.values(added).reduce((a, b) => a + b, 0)
    if (!total) return
    setNewFrameName('')
    loadFrames()
    const where = Object.entries(added).map(([s, n]) => `${n} to ${CANVAS_SIZES[s].label}`).join(', ')
    addToast(`${total} frame${total === 1 ? '' : 's'} added: ${where}.`)
    // Show the new frames: jump to their size when they all landed somewhere else.
    const sizes = Object.keys(added)
    if (sizes.length === 1 && sizes[0] !== size) setSize(sizes[0])
    setFrameTab('club')
  }

  const removeFrame = async frame => {
    const { ok } = await run(supabase.from('media_frames').delete().eq('id', frame.id), { failure: 'The frame was not removed.' })
    if (!ok) return
    // Frames imported by the script live under frames/; the API only cleans up its own uploads.
    if (!frame.url.includes('/frames/')) deleteUploadedFile(frame.url)
    loadFrames()
  }

  const rawCount = (post?.assets || []).filter(a => a.kind === 'raw').length

  return (
    <div>
      <PageHeader
        eyebrow="Publish"
        title="Frame studio"
        description="Frame, edit and caption a whole shoot at once. Drag to move a photo or a text, scroll to zoom or resize."
        actions={
          <>
            <Link to={post ? `/admin/media?post=${post.id}` : '/admin/media'} className="adm-btn"><ArrowLeft size={15} /> Planner</Link>
            <Button icon={ImagePlus} busy={busy === 'load'} busyLabel="Opening…" onClick={() => fileInput.current?.click()}>Add photos</Button>
          </>
        }
      />

      {post && (
        <Panel className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 mb-4">
          <span className="text-sm">
            Working on <strong>{post.title}</strong>
            <span style={{ color: 'var(--adm-silk-faint)' }}> · {rawCount} raw photo{rawCount === 1 ? '' : 's'}</span>
          </span>
          <div className="flex gap-2">
            <Button size="sm" icon={Images} disabled={!rawCount || busy === 'load'} onClick={addFromPost}>Load raw photos</Button>
            <Button size="sm" variant="primary" icon={Upload} disabled={!photos.length} busy={busy === 'save'} busyLabel="Saving…" onClick={saveToPost}>
              Save {photos.length || ''} as finals
            </Button>
          </div>
        </Panel>
      )}

      <Panel className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5 mb-3">
        <Segmented label="Canvas size" value={size} onChange={setSize}
          options={Object.entries(CANVAS_SIZES).map(([value, s]) => {
            const count = frames.filter(f => f.size === value).length
            return { value, label: count ? `${s.label} · ${count}` : s.label }
          })} />
        <Segmented label="Photo fit" value={fit}
          onChange={value => { setFit(value); if (value === 'cover') setPhotos(p => p.map(ph => ({ ...ph, zoom: Math.max(1, ph.zoom) }))) }}
          options={[{ value: 'cover', label: 'Fill' }, { value: 'contain', label: 'Fit whole photo' }]} />
        <div className="flex items-center gap-2 ml-auto">
          <span className="adm-data text-[11px]" style={{ color: 'var(--adm-silk-faint)' }}>{width}×{height}</span>
          <Segmented label="File type" value={format} onChange={setFormat}
            options={[{ value: 'jpeg', label: 'JPG' }, { value: 'png', label: 'PNG' }]} />
          <Button size="sm" icon={Download} disabled={!photo} onClick={downloadOne}>This one</Button>
          <Button size="sm" variant="primary" icon={FolderDown} disabled={!photos.length} busy={busy === 'zip'} busyLabel="Zipping…" onClick={downloadAll}>
            All {photos.length || ''} as zip
          </Button>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] items-start">
        <div className="flex flex-col gap-3 min-w-0">
          <Panel className="p-3 sm:p-4">
            <div
              className="relative mx-auto flex items-center justify-center"
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files) }}
            >
              {photos.length === 0 ? (
                <div className="w-full">
                  <EmptyState
                    icon={ImagePlus}
                    title="Drop photos here"
                    description="Or add them from your computer. They stay on this device until you download them or save them to a post."
                    action={<Button variant="primary" icon={ImagePlus} onClick={() => fileInput.current?.click()}>Add photos</Button>}
                  />
                </div>
              ) : (
                <canvas
                  ref={canvasRef}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  className="block rounded-lg"
                  style={{
                    // Leaves room for the toolbar, the photo controls and the strip below, so nothing needs scrolling.
                    maxWidth: '100%', maxHeight: 'max(320px, calc(100vh - 330px))', width: 'auto', height: 'auto',
                    aspectRatio: `${width} / ${height}`, cursor: tool === 'blur' ? 'crosshair' : 'grab', touchAction: 'none',
                    boxShadow: 'var(--adm-shadow-lift)',
                  }}
                  aria-label="Preview. Drag to move the photo or a text."
                />
              )}
            </div>

            {photo && (
              <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
                <div className="flex items-center gap-1">
                  <IconButton icon={ChevronLeft} label="Previous photo" onClick={() => setCurrent(c => Math.max(0, c - 1))} disabled={current === 0} />
                  <span className="adm-data text-[12px]" style={{ color: 'var(--adm-silk-dim)' }}>{current + 1} / {photos.length}</span>
                  <IconButton icon={ChevronRight} label="Next photo" onClick={() => setCurrent(c => Math.min(photos.length - 1, c + 1))} disabled={current >= photos.length - 1} />
                </div>
                <label className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--adm-silk-dim)' }}>
                  Zoom
                  <input type="range" min={fit === 'cover' ? 1 : 0.3} max={4} step={0.01} value={photo.zoom}
                    onChange={e => updatePhoto({ zoom: Number(e.target.value) })} style={{ width: 120 }} />
                </label>
                <div className="flex items-center gap-1">
                  <IconButton icon={RotateCcw} label="Turn left" onClick={() => updatePhoto({ rotate: ((photo.rotate || 0) + 270) % 360, x: 0, y: 0 })} />
                  <IconButton icon={RotateCw} label="Turn right" onClick={() => updatePhoto({ rotate: ((photo.rotate || 0) + 90) % 360, x: 0, y: 0 })} />
                  <IconButton icon={FlipHorizontal2} label="Mirror" onClick={() => updatePhoto({ flipX: !photo.flipX })} />
                  <IconButton icon={FlipVertical2} label="Flip upside down" onClick={() => updatePhoto({ flipY: !photo.flipY })} />
                </div>
                <Button size="sm" icon={RefreshCcw}
                  onClick={() => updatePhoto({ zoom: 1, x: 0, y: 0, rotate: 0, flipX: false, flipY: false, adjust: null })}>
                  Reset photo
                </Button>
              </div>
            )}
          </Panel>

          {photos.length > 0 && (
            <Panel className="p-3">
              <div className="adm-scroll flex gap-2 overflow-x-auto pb-1">
                {photos.map((ph, i) => (
                  <div key={ph.id} className="relative shrink-0 group">
                    <button type="button" onClick={() => setCurrent(i)} title={ph.name}
                      className="block rounded-lg overflow-hidden"
                      style={{ width: 56, height: 56, outline: i === current ? '2px solid var(--adm-signal)' : '1px solid var(--adm-trace)', outlineOffset: 1 }}>
                      <img src={ph.img.src} alt={ph.name} className="w-full h-full object-cover"
                        style={{ transform: `rotate(${ph.rotate || 0}deg) scale(${ph.flipX ? -1 : 1}, ${ph.flipY ? -1 : 1})` }} />
                    </button>
                    {(ownFrameOf(ph) != null || ph.adjust || ph.blurs?.length > 0) && (
                      <span className="absolute bottom-1 left-1 rounded px-1 text-[9px] font-bold pointer-events-none"
                        title={[ownFrameOf(ph) != null && 'Own frame', ph.adjust && 'Own edit', ph.blurs?.length > 0 && 'Faces blurred'].filter(Boolean).join(' · ')}
                        style={{ background: 'var(--adm-signal)', color: '#fff' }}>
                        {[ownFrameOf(ph) != null && 'F', ph.adjust && 'E', ph.blurs?.length > 0 && 'B'].filter(Boolean).join('')}
                      </span>
                    )}
                    <button type="button" onClick={() => removePhoto(i)} aria-label={`Remove ${ph.name}`}
                      className="absolute -top-1.5 -right-1.5 hidden group-hover:flex items-center justify-center rounded-full"
                      style={{ width: 20, height: 20, background: 'var(--adm-panel)', border: '1px solid var(--adm-trace)' }}>
                      <X size={11} />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => fileInput.current?.click()} aria-label="Add photos"
                  className="shrink-0 flex items-center justify-center rounded-lg"
                  style={{ width: 56, height: 56, border: '1.5px dashed var(--adm-trace-strong)', color: 'var(--adm-silk-faint)' }}>
                  <ImagePlus size={18} />
                </button>
              </div>
            </Panel>
          )}
        </div>

        {/* The tools sit in tabs beside the picture and scroll on their own, so the page itself never has to. */}
        <div className="flex flex-col gap-3 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]">
          <div role="tablist" aria-label="Tools" className="grid grid-cols-4 gap-1 rounded-xl p-1 shrink-0"
            style={{ background: 'var(--adm-board-sunk)', border: '1px solid var(--adm-trace)' }}>
            {TOOL_TABS.map(t => {
              const on = tool === t.value
              const count = t.value === 'text' ? texts.length : t.value === 'blur' ? photo?.blurs?.length || 0 : 0
              return (
                <button key={t.value} type="button" role="tab" aria-selected={on} onClick={() => setTool(t.value)}
                  title={`${t.label} (${t.key})`}
                  className="flex items-center justify-center gap-1.5 rounded-lg text-[13px] font-semibold"
                  style={{ height: 38, background: on ? 'var(--adm-signal)' : 'transparent', color: on ? '#fff' : 'var(--adm-silk-dim)' }}>
                  <t.icon size={15} /> {t.label}
                  {count > 0 && <span className="adm-data text-[10px] opacity-80">{count}</span>}
                </button>
              )
            })}
          </div>

          <div className="adm-scroll flex flex-col gap-4 min-h-0 lg:overflow-y-auto pr-0.5">
          {tool === 'frame' && <Panel>
            <PanelHead title="Frame"
              description={frameMode === 'one' ? 'Only this photo.' : 'Every photo without its own frame.'}
              action={frameTab === 'club' && (
                <Button size="sm" variant="ghost" onClick={() => setManage(m => !m)}>{manage ? 'Done' : 'Manage'}</Button>
              )} />
            <div className="flex flex-col gap-3 p-3 sm:p-4 pt-0 sm:pt-0">
              {photo && (
                <div className="flex flex-wrap items-center gap-2">
                  <Segmented label="Frame applies to" value={frameMode} onChange={setFrameMode}
                    options={[{ value: 'all', label: 'All photos' }, { value: 'one', label: 'This photo' }]} />
                  {frameMode === 'one' && (
                    <Button size="sm" variant="ghost" onClick={shareThisFrame}>Use for all</Button>
                  )}
                </div>
              )}
              <Segmented label="Frame source" value={frameTab} onChange={setFrameTab}
                options={[{ value: 'club', label: 'Club frames' }, { value: 'designs', label: 'Designs' }]} />

              {frameTab === 'club' ? (
                <div className="flex flex-col gap-3"
                  onDragOver={e => { e.preventDefault(); e.stopPropagation() }}
                  onDrop={e => { e.preventDefault(); e.stopPropagation(); uploadFrames(e.dataTransfer.files) }}>
                  <div className="grid grid-cols-3 gap-2">
                    <button type="button" onClick={() => pickFrame('none')}
                      className="flex items-center justify-center rounded-lg text-[11px] font-semibold"
                      style={{
                        aspectRatio: `${width} / ${height}`, background: 'var(--adm-board-sunk)', color: 'var(--adm-silk-faint)',
                        outline: frameId === 'none' ? '2px solid var(--adm-signal)' : '1px solid var(--adm-trace)', outlineOffset: 1,
                      }}>
                      No frame
                    </button>
                    {sizeFrames.map(f => (
                      <div key={f.id} className="relative flex flex-col gap-1 min-w-0">
                        <button type="button" onClick={() => pickFrame(f.id)} title={f.name}
                          className="relative block w-full rounded-lg overflow-hidden"
                          style={{
                            aspectRatio: `${width} / ${height}`,
                            // Checkerboard, so the transparent window in the frame reads as see-through.
                            background: 'repeating-conic-gradient(#d4d7de 0% 25%, #ffffff 0% 50%) 0 0 / 12px 12px',
                            outline: frameId === f.id ? '2px solid var(--adm-signal)' : '1px solid var(--adm-trace)', outlineOffset: 1,
                          }}>
                          {/* The current photo under the frame, so each tile previews the real result. */}
                          {photo && <img src={photo.img.src} alt="" className="absolute inset-0 w-full h-full object-cover" />}
                          <img src={f.url} alt={f.name} loading="lazy" className="relative w-full h-full object-contain" />
                          {isNew(f) && (
                            <span className="absolute top-1 left-1 rounded px-1 text-[9px] font-bold"
                              style={{ background: 'var(--adm-signal)', color: '#fff' }}>NEW</span>
                          )}
                        </button>
                        <span className="truncate text-[10.5px] leading-tight" title={f.name}
                          style={{ color: frameId === f.id ? 'var(--adm-silk)' : 'var(--adm-silk-faint)' }}>
                          {f.name}
                        </span>
                        {manage && (
                          <IconButton icon={Trash2} label={`Remove ${f.name}`} danger size={12} onClick={() => removeFrame(f)}
                            className="absolute top-1 right-1" style={{ width: 22, height: 22, background: 'var(--adm-panel)' }} />
                        )}
                      </div>
                    ))}
                  </div>
                  {!sizeFrames.length && (
                    <p className="text-[12px]" style={{ color: 'var(--adm-silk-faint)' }}>
                      No club frames for {CANVAS_SIZES[size].label} yet. Upload one below, or pick a built-in design.
                    </p>
                  )}
                  {manage && (
                    <TextField label="Name for the next upload (optional)" value={newFrameName}
                      onChange={e => setNewFrameName(e.target.value)} placeholder="Ramadan" />
                  )}
                  <Button size="sm" icon={Upload} busy={busy === 'frame'} busyLabel="Uploading…" onClick={() => frameInput.current?.click()}>
                    Upload frame PNGs
                  </Button>
                  <p className="text-[11px] -mt-1.5" style={{ color: 'var(--adm-silk-faint)' }}>
                    Or drop them here. Each one goes to the size it fits:
                    {' '}{Object.values(CANVAS_SIZES).map(s => `${s.width}×${s.height}`).join(', ')}.
                  </p>
                </div>
              ) : (
                <DesignPicker value={designKey} onPick={key => pickFrame(DESIGN_PREFIX + key)}
                  options={designOptions} setOptions={setDesignOptions} photo={photo} logoPath={logoPath}
                  width={width} height={height} fontTick={fontTick} />
              )}
            </div>
          </Panel>}

          {tool === 'text' && (
            <TextLayersPanel texts={texts} setTexts={setTexts} selected={selected} setSelected={setSelected}
              onAdd={addText} photoId={photo?.id} />
          )}

          {tool === 'blur' && (
            <FaceBlurPanel photo={photo} selected={selectedBlur} setSelected={setSelectedBlur} updateBlur={updateBlur}
              removeBlur={removeBlur} clearBlurs={() => { updatePhoto({ blurs: [] }); setSelectedBlur(null) }} />
          )}

          {tool === 'edit' && (
            <FrameAdjustPanel photo={photo} adjust={adjust} setAdjust={setAdjust} updatePhoto={updatePhoto} />
          )}
          </div>
        </div>
      </div>

      <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={e => { addFiles(e.target.files); e.target.value = '' }} />
      <input ref={frameInput} type="file" accept="image/png" multiple hidden onChange={e => { uploadFrames(e.target.files); e.target.value = '' }} />
    </div>
  )
}
