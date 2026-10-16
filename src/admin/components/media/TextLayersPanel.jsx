import { useEffect, useRef } from 'react'
import {
  AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowUp, Copy, Crosshair, Italic, Plus, Trash2, Type,
} from 'lucide-react'
import { FONTS, FONT_GROUPS, fontOf, installFonts, nearestWeight } from '../../lib/frameFonts'
import Panel, { PanelHead } from '../ui/Panel'
import Button, { IconButton } from '../ui/Button'
import { ColorRow, Segmented, Slider, Toggle } from './FrameControls'

const ALIGNS = [
  { value: 'left', label: 'Align left', icon: AlignLeft },
  { value: 'center', label: 'Centre', icon: AlignCenter },
  { value: 'right', label: 'Align right', icon: AlignRight },
]

const WEIGHT_NAMES = { 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'Semibold', 700: 'Bold', 800: 'Extra bold', 900: 'Black' }

/**
 * The text layers on the frame studio's canvas: add, pick, restyle, reorder.
 * Layers are dragged on the canvas itself; this panel edits everything else.
 */
export default function TextLayersPanel({ texts, setTexts, selected, setSelected, onAdd, photoId }) {
  const textArea = useRef(null)
  const layer = texts.find(t => t.id === selected) || null

  useEffect(() => { installFonts() }, [])

  const patch = p => setTexts(ts => ts.map(t => (t.id === selected ? { ...t, ...p } : t)))
  const move = dir => setTexts(ts => {
    const i = ts.findIndex(t => t.id === selected)
    const j = i + dir
    if (i < 0 || j < 0 || j >= ts.length) return ts
    const next = [...ts]
    ;[next[i], next[j]] = [next[j], next[i]]
    return next
  })
  const duplicate = () => onAdd({ ...layer, y: Math.min(0.95, layer.y + 0.06), role: undefined })
  const remove = () => {
    setTexts(ts => ts.filter(t => t.id !== selected))
    setSelected(null)
  }

  const setFont = font => patch({ font, weight: nearestWeight(font, layer.weight) })

  return (
    <Panel>
      <PanelHead title="Text" description="Drag text on the picture to move it." action={
        <Button size="sm" icon={Plus} onClick={() => { onAdd(); setTimeout(() => textArea.current?.select(), 0) }}>Add text</Button>
      } />

      {texts.length > 0 && (
        <div className="flex flex-col gap-1 px-3 sm:px-4 pb-3">
          {texts.map(t => (
            <button key={t.id} type="button" onClick={() => setSelected(t.id === selected ? null : t.id)}
              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px]"
              style={{
                background: t.id === selected ? 'var(--adm-board-sunk)' : 'transparent',
                outline: t.id === selected ? '1px solid var(--adm-signal)' : '1px solid var(--adm-trace)',
              }}>
              <Type size={13} className="shrink-0" style={{ color: 'var(--adm-silk-faint)' }} />
              <span className="truncate flex-1" dir="auto" style={{ fontFamily: `"${t.font}"`, fontWeight: t.weight }}>
                {t.text.split('\n')[0] || 'Empty'}
              </span>
              {t.scope !== 'all' && (
                <span className="text-[10px] shrink-0" style={{ color: t.scope === photoId ? 'var(--adm-signal)' : 'var(--adm-silk-faint)' }}>
                  {t.scope === photoId ? 'this photo' : 'other photo'}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {layer && (
        <div className="flex flex-col gap-3 p-3 sm:p-4 pt-3 sm:pt-3" style={{ borderTop: '1px solid var(--adm-trace)' }}>
          <textarea ref={textArea} className="adm-input" rows={2} dir="auto" value={layer.text}
            onChange={e => patch({ text: e.target.value })} aria-label="Text"
            style={{ fontFamily: `"${layer.font}"`, fontWeight: layer.weight, resize: 'vertical' }} />

          <div className="grid grid-cols-[1fr_auto] gap-2">
            <select className="adm-input" value={layer.font} onChange={e => setFont(e.target.value)} aria-label="Font">
              {FONT_GROUPS.map(g => (
                <optgroup key={g.script} label={g.label}>
                  {FONTS.filter(f => f.script === g.script).map(f => (
                    <option key={f.family} value={f.family} style={{ fontFamily: `"${f.family}"` }}>{f.family}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <select className="adm-input" value={nearestWeight(layer.font, layer.weight)} onChange={e => patch({ weight: Number(e.target.value) })}
              aria-label="Weight" disabled={fontOf(layer.font).weights.length < 2}>
              {fontOf(layer.font).weights.map(w => <option key={w} value={w}>{WEIGHT_NAMES[w] || w}</option>)}
            </select>
          </div>

          <Slider label="Size" min={12} max={260} value={layer.size} onChange={size => patch({ size })} />
          <ColorRow label="Colour" value={layer.color} onChange={color => patch({ color })} />

          <div className="flex flex-wrap items-center gap-1.5">
            <Segmented label="Alignment" options={ALIGNS} value={layer.align} onChange={align => patch({ align })} />
            <Toggle on={layer.italic} onChange={italic => patch({ italic })} title="Italic"><Italic size={14} /></Toggle>
            <Toggle on={layer.upper} onChange={upper => patch({ upper })} title="Capitals">AA</Toggle>
            <Toggle on={layer.shadow} onChange={shadow => patch({ shadow })} title="Drop shadow">Shadow</Toggle>
          </div>

          <details className="text-[12px]">
            <summary className="cursor-pointer font-semibold" style={{ color: 'var(--adm-silk-dim)' }}>Outline & box</summary>
            <div className="flex flex-col gap-2.5 mt-2.5">
              <Slider label="Outline" min={0} max={16} value={layer.stroke} onChange={stroke => patch({ stroke })} />
              {layer.stroke > 0 && <ColorRow label="Outline colour" value={layer.strokeColor} onChange={strokeColor => patch({ strokeColor })} />}
              <div className="flex items-center gap-3">
                <span style={{ width: 76, color: 'var(--adm-silk-dim)' }}>Box</span>
                <Toggle on={!!layer.bg} onChange={on => patch({ bg: on ? '#050A30' : '' })}>{layer.bg ? 'On' : 'Off'}</Toggle>
              </div>
              {layer.bg && (
                <>
                  <ColorRow label="Box colour" value={layer.bg} onChange={bg => patch({ bg })} />
                  <Slider label="Box opacity" min={0.1} max={1} step={0.05} value={layer.bgOpacity} onChange={bgOpacity => patch({ bgOpacity })} />
                  <Slider label="Padding" min={4} max={80} value={layer.pad} onChange={pad => patch({ pad })} />
                  <Slider label="Corners" min={0} max={60} value={layer.radius} onChange={radius => patch({ radius })} />
                </>
              )}
            </div>
          </details>

          <details className="text-[12px]">
            <summary className="cursor-pointer font-semibold" style={{ color: 'var(--adm-silk-dim)' }}>Spacing & angle</summary>
            <div className="flex flex-col gap-2.5 mt-2.5">
              <Slider label="Letters" min={-5} max={40} value={layer.spacing} onChange={spacing => patch({ spacing })} />
              <Slider label="Lines" min={0.8} max={2.2} step={0.05} value={layer.lineHeight} onChange={lineHeight => patch({ lineHeight })} />
              <Slider label="Rotate" min={-180} max={180} value={layer.rotate} onChange={rotate => patch({ rotate })} suffix="°" />
              <Slider label="Opacity" min={0.1} max={1} step={0.05} value={layer.opacity} onChange={opacity => patch({ opacity })} />
            </div>
          </details>

          <div className="flex flex-wrap items-center gap-1.5">
            <Segmented label="Show on" value={layer.scope === 'all' ? 'all' : 'one'}
              onChange={v => patch({ scope: v === 'all' ? 'all' : photoId })}
              options={[{ value: 'all', label: 'All photos' }, { value: 'one', label: 'This photo' }]} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <div className="flex items-center gap-1">
              <IconButton icon={Crosshair} label="Centre on the picture" onClick={() => patch({ x: 0.5, y: 0.5, align: 'center' })} />
              <IconButton icon={ArrowUp} label="Bring forward" onClick={() => move(1)} />
              <IconButton icon={ArrowDown} label="Send backward" onClick={() => move(-1)} />
              <IconButton icon={Copy} label="Duplicate" onClick={duplicate} />
            </div>
            <Button size="sm" variant="danger" icon={Trash2} onClick={remove}>Remove</Button>
          </div>
        </div>
      )}
    </Panel>
  )
}
