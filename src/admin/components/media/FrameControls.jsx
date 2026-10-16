/** Small controls shared by the frame studio's side panels. */

export const SWATCHES = ['#FFFFFF', '#050A30', '#233DFF', '#5CBCF9', '#CAE8FF', '#000000', '#FFD23F', '#FF4D6D', '#2EC4B6']

export function Slider({ label, min, max, step = 1, value, onChange, suffix = '' }) {
  return (
    <label className="flex items-center gap-3 text-[12px]" style={{ color: 'var(--adm-silk-dim)' }}>
      <span style={{ width: 76 }} className="shrink-0">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} className="flex-1 min-w-0"
        onChange={e => onChange(Number(e.target.value))} />
      <span className="adm-data shrink-0" style={{ width: 36, textAlign: 'right' }}>{Math.round(value * 100) / 100}{suffix}</span>
    </label>
  )
}

/** Brand swatches plus the browser's own picker for anything else. */
export function ColorRow({ label, value, onChange, swatches = SWATCHES }) {
  return (
    <div className="flex items-center gap-3 text-[12px]" style={{ color: 'var(--adm-silk-dim)' }}>
      {label && <span style={{ width: 76 }} className="shrink-0">{label}</span>}
      <div className="flex flex-wrap items-center gap-1.5">
        {swatches.map(c => (
          <button key={c} type="button" onClick={() => onChange(c)} aria-label={`Colour ${c}`} title={c}
            className="rounded-full"
            style={{
              width: 20, height: 20, background: c, border: '1px solid var(--adm-trace-strong)',
              outline: value?.toUpperCase() === c ? '2px solid var(--adm-signal)' : 'none', outlineOffset: 1,
            }} />
        ))}
        <input type="color" value={value || '#FFFFFF'} onChange={e => onChange(e.target.value.toUpperCase())} aria-label="Pick any colour"
          style={{ width: 26, height: 22, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }} />
      </div>
    </div>
  )
}

/** A row of mutually exclusive small buttons. */
export function Segmented({ options, value, onChange, label }) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--adm-trace)' }}>
      {options.map(o => {
        const Icon = o.icon
        const on = value === o.value
        return (
          <button key={o.value} type="button" onClick={() => onChange(o.value)} aria-pressed={on} title={o.label}
            className="flex items-center justify-center gap-1 px-2.5 text-[12px] font-semibold"
            style={{ height: 30, background: on ? 'var(--adm-signal)' : 'transparent', color: on ? '#fff' : 'var(--adm-silk-dim)' }}>
            {Icon ? <Icon size={14} /> : null}
            {(!Icon || o.showLabel) && o.label}
          </button>
        )
      })}
    </div>
  )
}

/** An on/off pill. */
export function Toggle({ on, onChange, children, title }) {
  return (
    <button type="button" onClick={() => onChange(!on)} aria-pressed={on} title={title}
      className="inline-flex items-center gap-1 rounded-lg px-2.5 text-[12px] font-semibold"
      style={{
        height: 30, border: '1px solid var(--adm-trace)',
        background: on ? 'var(--adm-signal)' : 'transparent', color: on ? '#fff' : 'var(--adm-silk-dim)',
      }}>
      {children}
    </button>
  )
}
