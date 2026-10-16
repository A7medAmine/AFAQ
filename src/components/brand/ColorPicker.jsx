import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ClipboardPaste, Pipette } from 'lucide-react'

// Any CSS colour the browser understands (hex with or without #, rgb(), hsl(),
// names, "35, 61, 255") normalised to #RRGGBB, or null.
let probe
export function parseColor(input) {
  let s = String(input || '').trim().replace(/;$/, '')
  if (!s) return null
  if (/^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(s)) s = '#' + s
  else if (/^\d{1,3}\s*[,\s]\s*\d{1,3}\s*[,\s]\s*\d{1,3}$/.test(s)) s = `rgb(${s.split(/[\s,]+/).join(',')})`
  probe ??= document.createElement('canvas').getContext('2d')
  probe.fillStyle = '#010203'
  probe.fillStyle = s
  const out = probe.fillStyle
  if (out === '#010203' && !/^#?010203$/i.test(s)) return null
  if (out.startsWith('#')) return out.toUpperCase()
  const m = out.match(/\d+(\.\d+)?/g) // rgba(...) form when alpha < 1: drop alpha
  return m ? '#' + m.slice(0, 3).map(n => (+n).toString(16).padStart(2, '0')).join('').toUpperCase() : null
}

const hexToHsv = hex => {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255
  const max = Math.max(r, g, b), d = max - Math.min(r, g, b)
  let h = 0
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max }
}

const hsvToHex = ({ h, s, v }) => {
  const f = k => {
    const x = (k + h / 60) % 6
    return Math.round(255 * (v - v * s * Math.max(0, Math.min(x, 4 - x, 1))))
  }
  return '#' + [f(5), f(3), f(1)].map(n => n.toString(16).padStart(2, '0')).join('').toUpperCase()
}

const clamp = n => Math.min(1, Math.max(0, n))

// Pointer drag over an element, reporting 0..1 coordinates.
function useDrag(onMove) {
  const ref = useRef()
  const move = e => {
    const r = ref.current.getBoundingClientRect()
    onMove(clamp((e.clientX - r.left) / r.width), clamp((e.clientY - r.top) / r.height))
  }
  return {
    ref,
    onPointerDown: e => { e.currentTarget.setPointerCapture(e.pointerId); move(e) },
    onPointerMove: e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) move(e) },
  }
}

const hasEyeDropper = typeof window !== 'undefined' && 'EyeDropper' in window

/** Saturation/value square, hue slider, free-text field that takes pasted colours, and a screen eyedropper. */
export default function ColorPicker({ value, onChange }) {
  const { t } = useTranslation('brand')
  const [hsv, setHsv] = useState(() => hexToHsv(value || '#FFFFFF'))
  const [text, setText] = useState(value || '')
  const [bad, setBad] = useState(false)
  const last = useRef(value)

  // Follow outside changes (swatch clicks) without losing hue on greys.
  useEffect(() => {
    if (!value || value === last.current) return
    last.current = value
    setHsv(prev => {
      const next = hexToHsv(value)
      return next.s === 0 || next.v === 0 ? { ...next, h: prev.h } : next
    })
    setText(value)
    setBad(false)
  }, [value])

  const emit = next => {
    setHsv(next)
    const hex = hsvToHex(next)
    last.current = hex
    setText(hex)
    setBad(false)
    onChange(hex)
  }

  // keepText: live typing, so "#233" doesn't get rewritten to "#223333" mid-word.
  const commit = (raw, keepText) => {
    const hex = parseColor(raw)
    if (!hex) { setBad(true); return false }
    last.current = hex
    setHsv(prev => {
      const next = hexToHsv(hex)
      return next.s === 0 || next.v === 0 ? { ...next, h: prev.h } : next
    })
    if (!keepText) setText(hex)
    setBad(false)
    onChange(hex)
    return true
  }

  const sv = useDrag((x, y) => emit({ ...hsv, s: x, v: 1 - y }))
  const hue = useDrag(x => emit({ ...hsv, h: x * 360 }))

  const pick = async () => {
    try {
      const { sRGBHex } = await new window.EyeDropper().open()
      commit(sRGBHex)
    } catch { /* user pressed Esc */ }
  }

  const pasteClipboard = async () => {
    try { commit(await navigator.clipboard.readText()) } catch { setBad(true) }
  }

  const key = (e, dx, dy) => {
    const step = e.shiftKey ? 0.1 : 0.01
    if (dx || dy) { e.preventDefault(); emit({ ...hsv, s: clamp(hsv.s + dx * step), v: clamp(hsv.v + dy * step) }) }
  }

  return (
    <div className="bk-cp">
      <div
        {...sv}
        className="bk-cp-sv"
        style={{ background: `hsl(${hsv.h} 100% 50%)` }}
        role="slider"
        tabIndex={0}
        aria-label={t('logo.picker.sv')}
        aria-valuetext={hsvToHex(hsv)}
        onKeyDown={e => key(e,
          e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0,
          e.key === 'ArrowUp' ? 1 : e.key === 'ArrowDown' ? -1 : 0)}
      >
        <span className="bk-cp-thumb" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: hsvToHex(hsv) }} />
      </div>
      <div
        {...hue}
        className="bk-cp-hue"
        role="slider"
        tabIndex={0}
        aria-label={t('logo.picker.hue')}
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(hsv.h)}
        onKeyDown={e => {
          const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0
          if (d) { e.preventDefault(); emit({ ...hsv, h: (hsv.h + d * (e.shiftKey ? 10 : 1) + 360) % 360 }) }
        }}
      >
        <span className="bk-cp-thumb" style={{ left: `${(hsv.h / 360) * 100}%`, top: '50%', background: `hsl(${hsv.h} 100% 50%)` }} />
      </div>
      <div className="flex gap-2 items-stretch">
        <input
          className="bk-input bk-mono flex-1 min-w-0"
          style={{ padding: '7px 10px', fontSize: 13, ...(bad ? { borderColor: '#dc2626' } : null) }}
          dir="ltr"
          spellCheck={false}
          value={text}
          placeholder="#233DFF, rgb(…), hsl(…)"
          aria-label={t('logo.picker.input')}
          aria-invalid={bad}
          onChange={e => { setText(e.target.value); if (parseColor(e.target.value)) commit(e.target.value, true); else setBad(false) }}
          onPaste={e => { e.preventDefault(); const s = e.clipboardData.getData('text'); setText(s); commit(s) }}
          onBlur={() => (parseColor(text) ? commit(text) : text && setBad(true))}
          onKeyDown={e => e.key === 'Enter' && commit(text)}
        />
        <button type="button" className="bk-btn" onClick={pasteClipboard} title={t('logo.picker.paste')} aria-label={t('logo.picker.paste')}>
          <ClipboardPaste size={15} />
        </button>
        {hasEyeDropper && (
          <button type="button" className="bk-btn" onClick={pick} title={t('logo.picker.eyedropper')} aria-label={t('logo.picker.eyedropper')}>
            <Pipette size={15} />
          </button>
        )}
      </div>
      {bad && <p className="text-xs" style={{ color: '#dc2626' }}>{t('logo.picker.invalid')}</p>}
    </div>
  )
}
