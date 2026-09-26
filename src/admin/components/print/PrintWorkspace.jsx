import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { ArrowLeft, Printer, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'
import Button, { IconButton } from '../ui/Button'
import { Field } from '../ui/Field'
import Panel from '../ui/Panel'

/**
 * Settings on the left, a to-scale preview of every sheet on the right. The
 * sheets are rendered a second time into a body-level portal that is the only
 * thing visible when printing, with the page margin forced to zero — the
 * sheets carry their own margins, so the admin chrome and the browser's
 * default margins can't shift anything.
 */
export default function PrintWorkspace({ backTo, backLabel, summary, paper, sheets, settings, onReset }) {
  const [zoom, setZoom] = useState(0.6)

  useEffect(() => {
    document.body.classList.add('adm-print-mode')
    return () => document.body.classList.remove('adm-print-mode')
  }, [])

  return (
    <div>
      <div className="adm-no-print flex flex-wrap items-center justify-between gap-3 mb-6">
        <Link to={backTo} className="adm-btn adm-btn-ghost">
          <ArrowLeft size={15} /> {backLabel}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm" style={{ color: 'var(--adm-silk-faint)' }}>
            {summary} · {sheets.length} page{sheets.length === 1 ? '' : 's'}
          </span>
          <Button variant="primary" icon={Printer} disabled={!sheets.length} onClick={() => window.print()}>Print</Button>
        </div>
      </div>

      <div className="adm-no-print grid gap-5 items-start" style={{ gridTemplateColumns: 'minmax(0, 330px) minmax(0, 1fr)' }}>
        <Panel className="p-4 flex flex-col gap-5" style={{ position: 'sticky', top: 16, maxHeight: 'calc(100vh - 32px)', overflowY: 'auto' }}>
          {settings}
          {onReset && (
            <Button size="sm" variant="ghost" icon={RotateCcw} onClick={onReset}>Reset to defaults</Button>
          )}
        </Panel>

        <div className="min-w-0">
          <div className="flex items-center justify-end gap-1 mb-3">
            <IconButton icon={ZoomOut} label="Zoom out" onClick={() => setZoom(z => Math.max(0.3, +(z - 0.1).toFixed(1)))} />
            <span className="adm-data text-xs w-10 text-center">{Math.round(zoom * 100)}%</span>
            <IconButton icon={ZoomIn} label="Zoom in" onClick={() => setZoom(z => Math.min(1.5, +(z + 0.1).toFixed(1)))} />
          </div>
          <div className="flex flex-wrap gap-6 justify-center">
            {sheets.map(sheet => (
              <div key={sheet.key}>
                <p className="text-xs mb-1.5" style={{ color: 'var(--adm-silk-faint)' }}>{sheet.title}</p>
                <div style={{ zoom, boxShadow: '0 2px 12px rgba(0,0,0,0.25)' }}>
                  <Sheet paper={paper}>{sheet.content}</Sheet>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {createPortal(
        <div className="adm-print-root">
          <style>{`@page { size: ${paper.w}mm ${paper.h}mm; margin: 0; }`}</style>
          {sheets.map(sheet => <Sheet key={sheet.key} paper={paper}>{sheet.content}</Sheet>)}
        </div>,
        document.body
      )}
    </div>
  )
}

function Sheet({ paper, children }) {
  return (
    <div
      className="adm-sheet"
      style={{
        // A hair shorter than the page so rounding never spills a blank page.
        width: `${paper.w}mm`,
        height: `${paper.h - 0.5}mm`,
        position: 'relative',
        overflow: 'hidden',
        background: '#fff',
        color: '#000',
      }}
    >
      {children}
    </div>
  )
}

/** Absolutely positioned slot on a sheet, in mm. */
export function Cell({ x, y, w, h, guide, children }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: `${x}mm`,
        top: `${y}mm`,
        width: `${w}mm`,
        height: `${h}mm`,
        outline: guide ? '0.2mm dashed #b8c0cc' : 'none',
        outlineOffset: 0,
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  )
}

export function SettingsGroup({ title, children }) {
  return (
    <section className="flex flex-col gap-3">
      <p className="adm-eyebrow">{title}</p>
      {children}
    </section>
  )
}

export function NumberSetting({ label, value, onChange, min, max, step = 1, suffix, hint }) {
  return (
    <Field label={label} hint={hint}>
      {a11y => (
        <div className="flex items-center gap-2">
          <input
            {...a11y}
            type="number"
            className="adm-input"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          />
          {suffix && <span className="text-xs shrink-0" style={{ color: 'var(--adm-silk-faint)' }}>{suffix}</span>}
        </div>
      )}
    </Field>
  )
}

export function ColorSetting({ label, value, onChange }) {
  return (
    <Field label={label}>
      {a11y => (
        <div className="flex items-center gap-2">
          <input {...a11y} type="color" value={value} onChange={e => onChange(e.target.value)}
            style={{ width: 40, height: 32, border: 'none', background: 'none', padding: 0, cursor: 'pointer' }} />
          <span className="adm-data text-xs" style={{ color: 'var(--adm-silk-dim)' }}>{value}</span>
        </div>
      )}
    </Field>
  )
}

/** Compact segmented choice that wraps inside the narrow settings column. */
export function ChoiceSetting({ label, options, value, onChange }) {
  return (
    <div>
      <span className="adm-label">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1">
        {options.map(o => {
          const active = o.value === value
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.value)}
              className="px-2.5 h-8 rounded-lg text-[12px] font-semibold transition-colors"
              style={{
                background: active ? 'var(--adm-signal-wash)' : 'var(--adm-board-sunk)',
                border: `1px solid ${active ? 'var(--adm-signal-edge)' : 'var(--adm-trace)'}`,
                color: active ? 'var(--adm-signal)' : 'var(--adm-silk-dim)',
              }}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
