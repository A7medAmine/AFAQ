import { useEffect, useRef } from 'react'
import { ADJUST_PRESETS, NEUTRAL_ADJUST, renderFrame } from '../../lib/frameRender'
import Panel, { PanelHead } from '../ui/Panel'
import Button from '../ui/Button'
import { Segmented, Slider } from './FrameControls'

const SLIDERS = [
  { key: 'brightness', label: 'Brightness', min: 50, max: 150 },
  { key: 'contrast', label: 'Contrast', min: 50, max: 150 },
  { key: 'saturation', label: 'Saturation', min: 0, max: 200 },
  { key: 'warmth', label: 'Warmth', min: 0, max: 60 },
  { key: 'hue', label: 'Hue', min: -180, max: 180 },
  { key: 'grayscale', label: 'Black & white', min: 0, max: 100 },
  { key: 'fade', label: 'Fade', min: 0, max: 60 },
  { key: 'vignette', label: 'Vignette', min: 0, max: 100 },
  { key: 'blur', label: 'Blur', min: 0, max: 20 },
]

const same = (a, b) => Object.keys(NEUTRAL_ADJUST).every(k => (a[k] ?? NEUTRAL_ADJUST[k]) === b[k])

/** The current photo, small, with one preset applied. */
function PresetThumb({ photo, adjust }) {
  const ref = useRef(null)
  useEffect(() => {
    const c = ref.current
    if (!c || !photo) return
    c.width = 72
    c.height = 72
    renderFrame(c.getContext('2d'), {
      width: 72, height: 72, photo: { ...photo, zoom: 1, x: 0, y: 0, adjust }, background: '#1C252D',
    })
  }, [photo?.img, photo?.rotate, photo?.flipX, photo?.flipY, adjust]) // eslint-disable-line react-hooks/exhaustive-deps
  return <canvas ref={ref} className="block w-full rounded-md" style={{ aspectRatio: '1 / 1', background: '#1C252D' }} />
}

/**
 * Looks and sliders for the photos. By default one look applies to the whole
 * shoot; switching to "This photo" gives the current photo its own settings.
 */
export default function FrameAdjustPanel({ photo, adjust, setAdjust, updatePhoto }) {
  const own = !!photo?.adjust
  const value = { ...NEUTRAL_ADJUST, ...(own ? photo.adjust : adjust) }
  const set = next => (own ? updatePhoto({ adjust: next }) : setAdjust(next))

  return (
    <Panel>
      <PanelHead title="Edit photo" description={own ? 'Only this photo.' : 'Applies to every photo.'} action={
        <Button size="sm" variant="ghost" onClick={() => set(NEUTRAL_ADJUST)}>Reset</Button>
      } />
      <div className="flex flex-col gap-3 p-3 sm:p-4 pt-0 sm:pt-0">
        {photo && (
          <Segmented label="Apply to" value={own ? 'one' : 'all'}
            onChange={v => updatePhoto({ adjust: v === 'one' ? { ...value } : null })}
            options={[{ value: 'all', label: 'All photos' }, { value: 'one', label: 'This photo' }]} />
        )}

        <div className="grid grid-cols-3 gap-2">
          {ADJUST_PRESETS.map(p => {
            const on = same(value, p.adjust)
            return (
              <button key={p.key} type="button" onClick={() => set(p.adjust)} aria-pressed={on}
                className="flex flex-col gap-1 rounded-lg p-1 text-[11px] font-semibold"
                style={{ outline: on ? '2px solid var(--adm-signal)' : '1px solid var(--adm-trace)', color: 'var(--adm-silk-dim)' }}>
                {photo ? <PresetThumb photo={photo} adjust={p.adjust} /> : null}
                {p.label}
              </button>
            )
          })}
        </div>

        <details open className="text-[12px]">
          <summary className="cursor-pointer font-semibold" style={{ color: 'var(--adm-silk-dim)' }}>Fine-tune</summary>
          <div className="flex flex-col gap-2.5 mt-2.5">
            {SLIDERS.map(s => (
              <Slider key={s.key} label={s.label} min={s.min} max={s.max} value={value[s.key]}
                onChange={v => set({ ...value, [s.key]: v })} />
            ))}
          </div>
        </details>
      </div>
    </Panel>
  )
}
