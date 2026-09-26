import { useMemo } from 'react'
import QRCode from 'qrcode'
import JsBarcode from 'jsbarcode'

/**
 * QR and barcode as inline SVG, generated synchronously from the value. Vector
 * output stays sharp at any print size, unlike the stored 300px PNGs.
 */
export function QrCode({ value, size, level = 'M', color = '#000' }) {
  const { path, count } = useMemo(() => {
    const qr = QRCode.create(value, { errorCorrectionLevel: level })
    const n = qr.modules.size
    let d = ''
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (qr.modules.get(y, x)) d += `M${x} ${y}h1v1h-1z`
      }
    }
    return { path: d, count: n }
  }, [value, level])

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
export function Barcode({ value, width, height, format = 'CODE128', color = '#000' }) {
  const svg = useMemo(() => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    try {
      JsBarcode(el, value, { format, displayValue: false, margin: 0, width: 2, height: 100, lineColor: color, background: 'transparent' })
    } catch {
      return null
    }
    const w = el.getAttribute('width')
    el.removeAttribute('width')
    el.removeAttribute('height')
    el.removeAttribute('style')
    el.setAttribute('viewBox', `0 0 ${parseFloat(w)} 100`)
    el.setAttribute('preserveAspectRatio', 'none')
    el.setAttribute('shape-rendering', 'crispEdges')
    el.setAttribute('width', '100%')
    el.setAttribute('height', '100%')
    return el.outerHTML
  }, [value, format, color])

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
