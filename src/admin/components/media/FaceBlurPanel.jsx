import { Trash2 } from 'lucide-react'
import Panel, { PanelHead } from '../ui/Panel'
import Button, { IconButton } from '../ui/Button'
import { Segmented, Slider } from './FrameControls'

/**
 * Hide faces on the current photo. Each blur is pinned to the photo itself,
 * so it follows the photo when it is moved, zoomed, turned or mirrored.
 * Adding and moving happen on the canvas; this panel tunes and removes them.
 */
export default function FaceBlurPanel({ photo, selected, setSelected, updateBlur, removeBlur, clearBlurs }) {
  const blurs = photo?.blurs || []
  const chosen = blurs.find(b => b.id === selected) || null

  return (
    <Panel>
      <PanelHead title="Blur faces" description="Only this photo."
        action={blurs.length > 0 && <Button size="sm" variant="ghost" onClick={clearBlurs}>Remove all</Button>} />
      <div className="flex flex-col gap-3 p-3 sm:p-4 pt-0 sm:pt-0">
        {!photo ? (
          <p className="text-[12px]" style={{ color: 'var(--adm-silk-faint)' }}>Add a photo first.</p>
        ) : (
          <>
            <p className="text-[12px] rounded-lg px-3 py-2" style={{ background: 'var(--adm-board-sunk)', color: 'var(--adm-silk-dim)' }}>
              <strong>Click a face</strong> on the photo to blur it. Drag a blur to move it, scroll over it to resize,
              and press Delete to remove the one you picked.
            </p>

            {blurs.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {blurs.map((b, i) => (
                  <button key={b.id} type="button" onClick={() => setSelected(b.id)} aria-pressed={b.id === selected}
                    className="rounded-lg px-2.5 text-[12px] font-semibold"
                    style={{
                      height: 28, border: '1px solid var(--adm-trace)',
                      background: b.id === selected ? 'var(--adm-signal)' : 'transparent',
                      color: b.id === selected ? '#fff' : 'var(--adm-silk-dim)',
                    }}>
                    Face {i + 1}
                  </button>
                ))}
              </div>
            )}

            {chosen ? (
              <div className="flex flex-col gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Segmented label="Style" value={chosen.style} onChange={style => updateBlur(chosen.id, { style })}
                    options={[{ value: 'blur', label: 'Blur' }, { value: 'pixelate', label: 'Pixelate' }]} />
                  <Segmented label="Shape" value={chosen.shape} onChange={shape => updateBlur(chosen.id, { shape })}
                    options={[{ value: 'oval', label: 'Oval' }, { value: 'box', label: 'Box' }]} />
                  <IconButton icon={Trash2} label="Remove this blur" danger onClick={() => removeBlur(chosen.id)} className="ml-auto" />
                </div>
                <Slider label="Size" min={0.02} max={0.4} step={0.005} value={chosen.size}
                  onChange={size => updateBlur(chosen.id, { size })} />
                <Slider label="Strength" min={0} max={100} value={chosen.strength}
                  onChange={strength => updateBlur(chosen.id, { strength })} />
              </div>
            ) : blurs.length > 0 && (
              <p className="text-[12px]" style={{ color: 'var(--adm-silk-faint)' }}>Pick a face to change its size or style.</p>
            )}
          </>
        )}
      </div>
    </Panel>
  )
}
