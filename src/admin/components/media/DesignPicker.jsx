import { useEffect, useRef } from 'react'
import { DESIGNS } from '../../lib/frameDesigns'
import { TEXT_DEFAULTS, renderFrame } from '../../lib/frameRender'
import { ColorRow, Toggle } from './FrameControls'

const THUMB_W = 108

/** One design drawn small over the current photo, with its sample words. */
function DesignThumb({ design, options, photo, logoPath, ratio, fontTick }) {
  const ref = useRef(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const width = THUMB_W * 2
    const height = Math.round(width * ratio)
    c.width = width
    c.height = height
    const texts = design.texts({ width, height }).map((t, i) => ({ ...TEXT_DEFAULTS, ...t, id: i }))
    renderFrame(c.getContext('2d'), {
      width, height, photo: photo ? { ...photo, zoom: 1, x: 0, y: 0, frame: undefined } : null,
      design: { key: design.key, ...options }, logoPath, texts, background: '#3C4C59',
    })
  }, [design, options, photo?.img, logoPath, ratio, fontTick]) // eslint-disable-line react-hooks/exhaustive-deps
  return <canvas ref={ref} className="block w-full h-full" />
}

/**
 * The built-in designs, plus the colours and logo switch they share.
 * `onPick` seeds the design's text layers; the page handles that.
 */
export default function DesignPicker({ value, onPick, options, setOptions, photo, logoPath, width, height, fontTick }) {
  const ratio = height / width
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        {DESIGNS.map(d => (
          <button key={d.key} type="button" onClick={() => onPick(d.key)} title={d.label}
            className="flex flex-col gap-1 text-[11px] font-semibold" style={{ color: 'var(--adm-silk-dim)' }}>
            <span className="block w-full rounded-lg overflow-hidden"
              style={{ aspectRatio: `${width} / ${height}`, outline: value === d.key ? '2px solid var(--adm-signal)' : '1px solid var(--adm-trace)', outlineOffset: 1 }}>
              <DesignThumb design={d} options={options} photo={photo} logoPath={logoPath} ratio={ratio} fontTick={fontTick} />
            </span>
            {d.label}
          </button>
        ))}
      </div>
      {value && (
        <div className="flex flex-col gap-2.5">
          <ColorRow label="Accent" value={options.accent} onChange={accent => setOptions(o => ({ ...o, accent }))} />
          <div className="flex items-center gap-3 text-[12px]" style={{ color: 'var(--adm-silk-dim)' }}>
            <span style={{ width: 76 }} className="shrink-0">Logo</span>
            <Toggle on={options.logo} onChange={logo => setOptions(o => ({ ...o, logo }))}>{options.logo ? 'Shown' : 'Hidden'}</Toggle>
          </div>
          {options.logo && <ColorRow label="Logo colour" value={options.ink} onChange={ink => setOptions(o => ({ ...o, ink }))} />}
        </div>
      )}
    </div>
  )
}
