import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy, Download as DownloadIcon, Shuffle, Dices } from 'lucide-react'
import { LOGO_SVG } from '../../data/brand'
import { BG_PATTERNS, BG_SIZES, BG_THEMES, renderBackground } from './bgRender'
import { useCopy } from './copy'

const PREVIEW_W = 1280

let pathPromise
function loadLogoPath() {
  pathPromise ??= fetch(LOGO_SVG('navy'))
    .then(r => r.text())
    .then(svg => new Path2D(svg.match(/ d="([^"]+)"/)[1]))
  return pathPromise
}

// Canvas text only uses a web font once it is loaded.
const fontsReady = () => Promise.all([
  document.fonts.load('40px "Minecraft"'),
  document.fonts.load('40px "Unixel"', 'آفاق'),
  document.fonts.load('500 40px "Thmanyah Sans"', 'آفاق'),
]).catch(() => {})

const DEFAULTS = {
  theme: 'midnight',
  pattern: 'horizon',
  density: 1,
  opacity: 0.35,
  seed: 7,
  glow: true,
  grain: false,
  logo: 'watermark',
  logoSize: 0.32,
  title: '',
  subtitle: '',
  textPos: 'bottom',
  textSize: 1,
}

const pick = arr => arr[Math.floor(Math.random() * arr.length)]

function Seg({ value, options, onChange, render }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(o => (
        <button
          key={o}
          type="button"
          aria-pressed={value === o}
          onClick={() => onChange(o)}
          className="bk-btn"
          style={value === o ? { borderColor: 'var(--bk-blue)', color: 'var(--bk-blue)', background: 'color-mix(in srgb, var(--bk-blue) 8%, var(--color-card))' } : undefined}
        >
          {render ? render(o) : o}
        </button>
      ))}
    </div>
  )
}

function Slider({ label, value, min, max, step, onChange, fmt = v => v }) {
  return (
    <label className="flex items-center gap-3 text-sm">
      <span className="bk-muted w-24 shrink-0">{label}</span>
      <input type="range" className="bk-range flex-1" min={min} max={max} step={step} value={value} onChange={e => onChange(+e.target.value)} />
      <span className="bk-mono text-xs w-10 text-end">{fmt(value)}</span>
    </label>
  )
}

export default function BackgroundGenerator() {
  const { t } = useTranslation('brand')
  const copy = useCopy()
  const [o, setO] = useState(DEFAULTS)
  const [sizeKey, setSizeKey] = useState('desktop')
  const [busy, setBusy] = useState(false)
  const [logoPath, setLogoPath] = useState(null)
  const canvasRef = useRef(null)

  const size = BG_SIZES.find(s => s.key === sizeKey)
  const set = patch => setO(prev => ({ ...prev, ...patch }))

  useEffect(() => {
    Promise.all([loadLogoPath(), fontsReady()]).then(([p]) => setLogoPath(p))
  }, [])

  useEffect(() => {
    const c = canvasRef.current
    if (!c || !logoPath) return
    const w = Math.min(PREVIEW_W, size.w)
    const h = Math.round(w * size.h / size.w)
    c.width = w
    c.height = h
    renderBackground(c.getContext('2d'), w, h, o, logoPath)
  }, [o, size, logoPath])

  const renderFull = () => {
    const c = document.createElement('canvas')
    c.width = size.w
    c.height = size.h
    renderBackground(c.getContext('2d'), size.w, size.h, o, logoPath)
    return new Promise(res => c.toBlob(res, 'image/png'))
  }

  const download = async () => {
    setBusy(true)
    const blob = await renderFull()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `afaq-bg-${o.theme}-${o.pattern}-${size.w}x${size.h}.png`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setBusy(false)
  }

  const copyImage = async () => {
    setBusy(true)
    try {
      const blob = await renderFull()
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      copy(`PNG ${size.w}×${size.h}`)
    } catch {
      copy(t('bg.copyFailed'))
    }
    setBusy(false)
  }

  const surprise = () => set({
    theme: pick(Object.keys(BG_THEMES)),
    pattern: pick(BG_PATTERNS.filter(p => p !== 'none')),
    density: +(0.6 + Math.random() * 1.2).toFixed(1),
    opacity: +(0.15 + Math.random() * 0.45).toFixed(2),
    seed: Math.floor(Math.random() * 1e6),
    glow: Math.random() < 0.8,
    logo: pick(['none', 'watermark', 'corner', 'center']),
  })

  return (
    <div className="grid lg:grid-cols-[1.6fr_1fr] gap-6 items-start">
      <div className="lg:sticky flex flex-col gap-4" style={{ top: 'calc(var(--nav-h) + 72px)' }}>
        <div className="bk-card p-3">
          <div className="rounded-xl overflow-hidden bk-checker grid place-items-center" style={{ maxHeight: '70vh' }}>
            <canvas
              ref={canvasRef}
              style={{ width: '100%', height: 'auto', maxHeight: '70vh', objectFit: 'contain', display: 'block', aspectRatio: `${size.w} / ${size.h}` }}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 px-1 pt-3">
            <span className="bk-mono text-xs bk-muted" dir="ltr">{size.w} × {size.h} px · PNG</span>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="bk-btn" onClick={surprise}><Dices size={15} />{t('bg.surprise')}</button>
              <button type="button" className="bk-btn" onClick={() => set({ seed: Math.floor(Math.random() * 1e6) })}><Shuffle size={15} />{t('bg.shuffle')}</button>
              <button type="button" className="bk-btn" onClick={copyImage} disabled={busy || !logoPath}><Copy size={15} />{t('bg.copyImage')}</button>
              <button type="button" className="bk-btn bk-btn-primary" onClick={download} disabled={busy || !logoPath}><DownloadIcon size={15} />{t('bg.download')}</button>
            </div>
          </div>
        </div>
      </div>

      <div className="bk-card p-5 flex flex-col gap-6">
        <div>
          <div className="text-sm font-medium mb-2">{t('bg.theme')}</div>
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(BG_THEMES).map(([k, th]) => (
              <button
                key={k}
                type="button"
                onClick={() => set({ theme: k })}
                aria-pressed={o.theme === k}
                className="rounded-lg overflow-hidden text-start cursor-pointer"
                style={{ outline: o.theme === k ? '2px solid var(--bk-blue)' : '1px solid var(--color-border-light)', outlineOffset: o.theme === k ? 2 : 0 }}
              >
                <div className="h-10 relative" style={{ background: `linear-gradient(135deg, ${th.bg[0]}, ${th.bg[1]})` }}>
                  <span className="absolute bottom-1.5 end-1.5 w-2.5 h-2.5" style={{ background: th.ink }} />
                </div>
                <div className="text-[11px] px-2 py-1">{t(`bg.themes.${k}`)}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-sm font-medium mb-2">{t('bg.pattern')}</div>
          <Seg value={o.pattern} options={BG_PATTERNS} onChange={v => set({ pattern: v })} render={p => t(`bg.patterns.${p}`)} />
        </div>

        <div className="flex flex-col gap-3">
          <Slider label={t('bg.density')} value={o.density} min={0.4} max={2} step={0.1} onChange={v => set({ density: v })} fmt={v => v.toFixed(1)} />
          <Slider label={t('bg.opacity')} value={o.opacity} min={0.05} max={1} step={0.05} onChange={v => set({ opacity: v })} fmt={v => Math.round(v * 100) + '%'} />
          <div className="flex flex-wrap gap-4 text-sm pt-1">
            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" className="bk-range" checked={o.glow} onChange={e => set({ glow: e.target.checked })} />{t('bg.glow')}</label>
            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" className="bk-range" checked={o.grain} onChange={e => set({ grain: e.target.checked })} />{t('bg.grain')}</label>
          </div>
        </div>

        <div>
          <div className="text-sm font-medium mb-2">{t('bg.logo')}</div>
          <Seg value={o.logo} options={['none', 'watermark', 'corner', 'center']} onChange={v => set({ logo: v })} render={v => t(`bg.logoPos.${v}`)} />
          {o.logo === 'center' && (
            <div className="mt-3"><Slider label={t('bg.logoSize')} value={o.logoSize} min={0.1} max={0.6} step={0.02} onChange={v => set({ logoSize: v })} fmt={v => Math.round(v * 100) + '%'} /></div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <div className="text-sm font-medium">{t('bg.text')}</div>
          <input className="bk-input" value={o.title} onChange={e => set({ title: e.target.value })} placeholder={t('bg.titlePh')} />
          <input className="bk-input" value={o.subtitle} onChange={e => set({ subtitle: e.target.value })} placeholder={t('bg.subtitlePh')} />
          {(o.title || o.subtitle) && (
            <div className="flex flex-col gap-3 pt-1">
              <Seg value={o.textPos} options={['bottom', 'center']} onChange={v => set({ textPos: v })} render={v => t(`bg.textPos.${v}`)} />
              <Slider label={t('bg.textSize')} value={o.textSize} min={0.4} max={2} step={0.1} onChange={v => set({ textSize: v })} fmt={v => v.toFixed(1)} />
            </div>
          )}
        </div>

        <div>
          <div className="text-sm font-medium mb-2">{t('bg.size')}</div>
          <select className="bk-input" value={sizeKey} onChange={e => setSizeKey(e.target.value)}>
            {BG_SIZES.map(s => <option key={s.key} value={s.key}>{t(`bg.sizes.${s.key}`)} — {s.w}×{s.h}</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}
