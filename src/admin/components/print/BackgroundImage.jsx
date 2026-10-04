import { useEffect, useState } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import { IconButton } from '../ui/Button'
import { ChoiceSetting, NumberSetting } from './PrintWorkspace'
import { clamp } from '../../lib/printLayout'

/** Longest side kept after downscaling — about 300 dpi across a 6.5 in badge. */
const MAX_SIDE = 2000

const FITS = [
  { value: 'cover', label: 'Fill' },
  { value: 'contain', label: 'Fit' },
  { value: 'stretch', label: 'Stretch' },
]

/**
 * A custom background image, kept in its own localStorage key next to the print
 * settings so a big image never stops the settings from saving. The image is
 * downscaled first; if it still does not fit in storage it works for this visit
 * and the admin is told it won't be remembered.
 */
export function useStoredImage(key) {
  const [src, setSrc] = useState(() => {
    try { return localStorage.getItem(key) || '' } catch { return '' }
  })
  const [remembered, setRemembered] = useState(true)

  useEffect(() => {
    try {
      if (src) localStorage.setItem(key, src)
      else localStorage.removeItem(key)
      setRemembered(true)
    } catch {
      setRemembered(false)
    }
  }, [key, src])

  const pick = async file => setSrc(await downscale(file))
  const clear = () => setSrc('')
  return { src, pick, clear, remembered }
}

async function downscale(file) {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('That file could not be read as an image.'))
      el.src = url
    })
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
    // WebP keeps transparency and stays small; browsers without a WebP encoder
    // hand back PNG, which is too heavy to store, so fall back to JPEG there.
    const webp = canvas.toDataURL('image/webp', 0.9)
    return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.9)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Upload / replace / remove, plus how the image sits and how much it is dimmed. */
export function ImageSetting({ label = 'Background image', image, fit, onFit, shade, onShade, shadeColor, onError }) {
  const choose = async e => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try { await image.pick(file) } catch (err) { onError?.(err.message) }
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <span className="adm-label">{label}</span>
        <div className="flex items-center gap-2">
          {image.src && (
            <div style={{
              width: 56, height: 40, borderRadius: 6, flexShrink: 0, border: '1px solid var(--adm-trace)',
              background: `center / cover no-repeat url("${image.src}")`,
            }} />
          )}
          <label className="adm-btn adm-btn-sm" style={{ cursor: 'pointer' }}>
            <ImagePlus size={14} />
            {image.src ? 'Replace' : 'Upload image'}
            <input type="file" accept="image/*" className="sr-only" onChange={choose} />
          </label>
          {image.src && <IconButton icon={Trash2} label="Remove background image" danger onClick={image.clear} />}
        </div>
        {!image.remembered && (
          <p className="text-xs mt-1.5" style={{ color: 'var(--adm-silk-faint)' }}>
            This image is too large to remember after a reload. It still prints now.
          </p>
        )}
      </div>
      {image.src && (
        <>
          <ChoiceSetting label="Image placement" options={FITS} value={fit} onChange={onFit} />
          <NumberSetting
            label="Darken / tint image"
            suffix="%"
            value={shade}
            min={0}
            max={90}
            step={5}
            hint={shadeColor ? 'Tinted with the background colour, so text stays readable.' : undefined}
            onChange={onShade}
          />
        </>
      )}
    </div>
  )
}

/** The image plus a tint layer, filling its (position: relative) parent. */
export function BackgroundLayer({ src, fit = 'cover', shade = 0, tint = '#000' }) {
  if (!src) return null
  const size = fit === 'stretch' ? '100% 100%' : fit
  return (
    <>
      <div aria-hidden style={{
        position: 'absolute', inset: 0,
        backgroundImage: `url("${src}")`, backgroundSize: size,
        backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
      }} />
      {shade > 0 && (
        <div aria-hidden style={{ position: 'absolute', inset: 0, background: tint, opacity: clamp(shade, 0, 90) / 100 }} />
      )}
    </>
  )
}
