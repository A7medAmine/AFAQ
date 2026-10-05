import QRCode from 'qrcode'
import JsBarcode from 'jsbarcode'

// A sheet repeats the same few codes many times; build each one once.
const qrCache = new Map()
const barcodeCache = new Map()

function qrPath(value, level) {
  const key = `${level}|${value}`
  let hit = qrCache.get(key)
  if (!hit) {
    const qr = QRCode.create(value, { errorCorrectionLevel: level })
    const n = qr.modules.size
    let d = ''
    // One rectangle per run of dark modules in a row, not one per module.
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (!qr.modules.get(y, x)) continue
        let run = 1
        while (x + run < n && qr.modules.get(y, x + run)) run++
        d += `M${x} ${y}h${run}v1h-${run}z`
        x += run - 1
      }
    }
    hit = { path: d, count: n }
    qrCache.set(key, hit)
  }
  return hit
}

/**
 * QR and barcode as inline SVG, generated synchronously from the value. Vector
 * output stays sharp at any print size, unlike the stored 300px PNGs.
 */
export function QrCode({ value, size, level = 'M', color = '#000' }) {
  const { path, count } = qrPath(value, level)

  return (
    <svg
      viewBox={`0 0 ${count} ${count}`}
      width={`${size}mm`}
      height={`${size}mm`}
      shapeRendering="crispEdges"
      style={{ display: 'block', flexShrink: 0 }}
      aria-label={value}
    >
      <path d={path} fill={color} />
    </svg>
  )
}

export const BARCODE_FORMATS = [
  { value: 'CODE128', label: 'Code 128' },
  { value: 'CODE39', label: 'Code 39' },
]

/**
 * A 1D barcode stretched to the box it's given. Bars scale horizontally only,
 * which keeps the bar-width ratios (what scanners read) intact.
 */
function barcodeSvg(value, format, color) {
  const key = `${format}|${color}|${value}`
  if (barcodeCache.has(key)) return barcodeCache.get(key)
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  let out = null
  try {
    JsBarcode(el, value, { format, displayValue: false, margin: 0, width: 2, height: 100, lineColor: color, background: 'transparent' })
    const w = el.getAttribute('width')
    el.removeAttribute('width')
    el.removeAttribute('height')
    el.removeAttribute('style')
    el.setAttribute('viewBox', `0 0 ${parseFloat(w)} 100`)
    el.setAttribute('preserveAspectRatio', 'none')
    el.setAttribute('shape-rendering', 'crispEdges')
    el.setAttribute('width', '100%')
    el.setAttribute('height', '100%')
    out = el.outerHTML
  } catch {
    out = null
  }
  barcodeCache.set(key, out)
  return out
}

export function Barcode({ value, width, height, format = 'CODE128', color = '#000' }) {
  const svg = barcodeSvg(value, format, color)

  if (!svg) {
    return <div style={{ fontSize: '6pt', color: '#b91c1c' }}>Can’t encode “{value}” as {format}</div>
  }
  return (
    <div
      style={{ width: typeof width === 'number' ? `${width}mm` : width, height: `${height}mm`, flexShrink: 0 }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
