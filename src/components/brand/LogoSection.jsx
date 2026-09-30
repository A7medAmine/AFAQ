import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy, Download as DownloadIcon } from 'lucide-react'
import { COLORS, LOGO_EXTRAS, LOGO_PNG, LOGO_SVG, LOGO_VARIANTS, PNG_SIZES } from '../../data/brand'
import { Download, useCopy } from './copy'

// One fetch of the mark; every recolour is a string swap on its fill.
let svgPromise
function loadMarkSvg() {
  svgPromise ??= fetch(LOGO_SVG('navy')).then(r => r.text())
  return svgPromise
}
const recolour = (svg, hex) => svg.replace(/fill="#[0-9A-Fa-f]{6}"/, `fill="${hex}"`)

function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function LogoCard({ variant }) {
  const { t } = useTranslation('brand')
  const copy = useCopy()
  const [size, setSize] = useState(1024)

  const copySvg = async () => copy(recolour(await loadMarkSvg(), variant.fill))

  return (
    <div className="bk-card bk-logo-card p-3 flex flex-col gap-3">
      <div className="bk-logo-tile" style={{ background: variant.bg, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.06)' }}>
        <img src={LOGO_SVG(variant.file)} alt="" loading="lazy" />
      </div>
      <div className="px-1 flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{t(`logo.variants.${variant.key}`)}</span>
        <span className="text-xs bk-muted bk-mono">{variant.fill}</span>
      </div>
      <div className="flex flex-wrap gap-2 px-1 pb-1">
        <button type="button" className="bk-btn" onClick={copySvg}><Copy size={14} />{t('logo.copySvg')}</button>
        <Download href={LOGO_SVG(variant.file)}><DownloadIcon size={14} />{t('logo.svg')}</Download>
        <div className="flex">
          <select
            aria-label={t('logo.size')}
            value={size}
            onChange={e => setSize(+e.target.value)}
            className="bk-btn"
            style={{ borderStartEndRadius: 0, borderEndEndRadius: 0, paddingInline: 8 }}
          >
            {PNG_SIZES.map(s => <option key={s} value={s}>{s}px</option>)}
          </select>
          <Download
            href={LOGO_PNG(variant.file, size)}
            style={{ borderStartStartRadius: 0, borderEndStartRadius: 0, marginInlineStart: -1 }}
          >
            <DownloadIcon size={14} />{t('logo.png')}
          </Download>
        </div>
      </div>
    </div>
  )
}

const SWATCHES = [...COLORS.map(c => c.hex), '#FFFFFF', '#000000']

function CustomExport() {
  const { t } = useTranslation('brand')
  const copy = useCopy()
  const [fill, setFill] = useState('#FFFFFF')
  const [bg, setBg] = useState('#233DFF')
  const [size, setSize] = useState(1024)
  const [svg, setSvg] = useState('')

  useEffect(() => { loadMarkSvg().then(setSvg) }, [])

  const coloured = svg && recolour(svg, fill)

  const download = () => {
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = c.height = size
      const ctx = c.getContext('2d')
      let pad = 0
      if (bg) {
        ctx.fillStyle = bg
        ctx.fillRect(0, 0, size, size)
        pad = size * 0.14 // keep clear space on solid tiles
      }
      ctx.drawImage(img, pad, pad, size - pad * 2, size - pad * 2)
      c.toBlob(b => saveBlob(b, `afaq-mark-${fill.slice(1)}${bg ? '-on-' + bg.slice(1) : ''}-${size}.png`), 'image/png')
    }
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(coloured)
  }

  const Chips = ({ value, onChange, allowNone }) => (
    <div className="flex flex-wrap gap-2 items-center">
      {allowNone && (
        <button type="button" aria-pressed={value === null} onClick={() => onChange(null)} className="bk-chip bk-checker" title={t('logo.transparent')} />
      )}
      {SWATCHES.map(h => (
        <button key={h} type="button" aria-pressed={value === h} onClick={() => onChange(h)} className="bk-chip" style={{ background: h }} title={h} />
      ))}
      <label className="bk-chip overflow-hidden relative" title="Custom" style={{ background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' }}>
        <input type="color" value={value || '#ffffff'} onChange={e => onChange(e.target.value.toUpperCase())} className="absolute inset-0 opacity-0 cursor-pointer" />
      </label>
    </div>
  )

  return (
    <div className="bk-card p-5 md:p-7 grid md:grid-cols-[1fr_1.1fr] gap-7 items-center">
      <div className={`bk-logo-tile ${bg ? '' : 'bk-checker'}`} style={{ background: bg || undefined, aspectRatio: '1 / 1' }}>
        {coloured && <div style={{ width: bg ? '60%' : '80%' }} dangerouslySetInnerHTML={{ __html: coloured.replace('<svg ', '<svg width="100%" height="100%" ') }} />}
      </div>
      <div className="flex flex-col gap-5">
        <div>
          <h3 className="bk-title text-xl mb-1">{t('logo.custom')}</h3>
          <p className="text-sm bk-muted">{t('logo.customHint')}</p>
        </div>
        <div>
          <div className="text-sm font-medium mb-2">{t('logo.markColor')} <span className="bk-mono bk-muted text-xs">{fill}</span></div>
          <Chips value={fill} onChange={v => v && setFill(v)} />
        </div>
        <div>
          <div className="text-sm font-medium mb-2">{t('logo.background')} <span className="bk-mono bk-muted text-xs">{bg || t('logo.transparent')}</span></div>
          <Chips value={bg} onChange={setBg} allowNone />
        </div>
        <div>
          <div className="text-sm font-medium mb-2">{t('logo.size')}</div>
          <div className="flex flex-wrap gap-2">
            {[...PNG_SIZES, 4096].map(s => (
              <button key={s} type="button" className="bk-btn" aria-pressed={size === s}
                style={size === s ? { borderColor: 'var(--bk-blue)', color: 'var(--bk-blue)' } : undefined}
                onClick={() => setSize(s)}>{s}px</button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="bk-btn bk-btn-primary bk-btn-lg" onClick={download} disabled={!svg}>
            <DownloadIcon size={16} />{t('logo.downloadPng')}
          </button>
          <button type="button" className="bk-btn bk-btn-lg" onClick={() => copy(coloured)} disabled={!svg}>
            <Copy size={16} />{t('logo.copySvg')}
          </button>
        </div>
      </div>
    </div>
  )
}

function Rules() {
  const { t } = useTranslation('brand')
  const mark = LOGO_SVG('navy')
  const donts = [
    { key: 'dont1', style: { transform: 'scaleX(1.5) rotate(-12deg)' } },
    { key: 'dont2', style: { filter: 'drop-shadow(6px 6px 0 #5CBCF9) drop-shadow(0 0 8px #233DFF)' } },
    { key: 'dont3', style: { filter: 'invert(33%) sepia(95%) saturate(2500%) hue-rotate(340deg)' } },
  ]
  return (
    <div className="grid lg:grid-cols-[1fr_1.4fr] gap-5">
      <div className="bk-card p-6">
        <h3 className="bk-title text-lg mb-4">{t('logo.rules.title')}</h3>
        <div className="bk-logo-tile mb-5" style={{ background: 'var(--bk-cloud)', aspectRatio: '16 / 10' }}>
          {/* clear-space diagram */}
          <div className="relative" style={{ width: '44%', padding: '9%', outline: '1.5px dashed #233DFF', outlineOffset: -1 }}>
            <img src={mark} alt="" style={{ width: '100%' }} />
            {['top-0 left-1/2 -translate-x-1/2', 'bottom-0 left-1/2 -translate-x-1/2', 'left-0 top-1/2 -translate-y-1/2', 'right-0 top-1/2 -translate-y-1/2'].map(p => (
              <span key={p} className={`absolute ${p} text-[10px] font-bold`} style={{ color: '#233DFF', padding: 2 }}>x</span>
            ))}
          </div>
        </div>
        <ul className="text-sm flex flex-col gap-2 bk-muted">
          <li>• {t('logo.rules.clearspace')}</li>
          <li>• {t('logo.rules.minSize')}</li>
          <li>• {t('logo.rules.contrast')}</li>
        </ul>
      </div>
      <div className="grid sm:grid-cols-3 gap-4 items-start">
        {donts.map(d => (
          <div key={d.key} className="bk-card p-3 flex flex-col gap-3">
            <div className="bk-logo-tile bk-dont" style={{ background: 'var(--bk-cloud)', aspectRatio: '1 / 1' }}>
              <img src={mark} alt="" style={{ ...d.style, width: '46%' }} />
            </div>
            <p className="text-sm bk-muted px-1 pb-1">{t(`logo.rules.${d.key}`)}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function LogoSection() {
  const { t } = useTranslation('brand')
  return (
    <div className="flex flex-col gap-10">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {LOGO_VARIANTS.map(v => <LogoCard key={v.key} variant={v} />)}
      </div>

      <CustomExport />

      <div>
        <h3 className="bk-title text-lg mb-4">{t('logo.extras')}</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {LOGO_EXTRAS.map(x => (
            <a key={x.key} href={x.file} download className="bk-card p-3 flex flex-col gap-3 bk-logo-card group">
              <div className="bk-logo-tile" style={{ background: x.bg, aspectRatio: '1 / 1' }}>
                <img src={x.file} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div className="flex items-center justify-between px-1 pb-1 text-sm">
                <span>{t(`logo.extrasNames.${x.key}`)}</span>
                <DownloadIcon size={15} className="bk-muted group-hover:text-[#233DFF]" />
              </div>
            </a>
          ))}
        </div>
      </div>

      <Rules />
    </div>
  )
}
