/**
 * Every screen now names itself. Before this, a page opened with a 12px grey
 * line of text and you had to read the sidebar to know where you were.
 */
export default function PageHeader({ eyebrow, title, description, actions, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div className="min-w-0">
        {eyebrow && <p className="adm-eyebrow mb-2">{eyebrow}</p>}
        <h1 className="text-[22px] leading-tight">{title}</h1>
        {description && (
          <p className="text-sm mt-1.5" style={{ color: 'var(--adm-silk-dim)' }}>{description}</p>
        )}
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  )
}

/** Segmented filter control. The selected value is announced, not just coloured. */
export function FilterTabs({ options, value, onChange, label = 'Filter' }) {
  return (
    <div
      role="tablist"
      aria-label={label}
      // Too many options for a phone width scroll sideways instead of spilling off the screen.
      className="adm-scroll inline-flex items-center gap-0.5 p-1 rounded-xl max-w-full overflow-x-auto"
      style={{ background: 'var(--adm-board-sunk)', border: '1px solid var(--adm-trace)' }}
    >
      {options.map(option => {
        const active = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className="flex shrink-0 items-center gap-1.5 px-3 h-8 rounded-lg text-[13px] font-semibold whitespace-nowrap transition-colors"
            style={{
              background: active ? 'var(--adm-panel)' : 'transparent',
              color: active ? 'var(--adm-silk)' : 'var(--adm-silk-faint)',
              boxShadow: active ? 'var(--adm-shadow)' : 'none',
            }}
          >
            {option.label}
            {option.count !== undefined && (
              <span
                className="adm-data text-[11px] px-1.5 rounded"
                style={{
                  background: active ? 'var(--adm-board-sunk)' : 'transparent',
                  color: active ? 'var(--adm-silk-dim)' : 'var(--adm-silk-faint)',
                }}
              >
                {option.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
