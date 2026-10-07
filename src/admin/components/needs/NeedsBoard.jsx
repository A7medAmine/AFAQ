import { useState } from 'react'
import { ITEM_STATUSES, kindLabel } from '../../lib/needs'

/**
 * The list as a board: one column per status. Drag a card to move it along,
 * or use the dropdown on the card (keyboard and touch).
 */
export default function NeedsBoard({ items, deptById, onStatus, onOpen }) {
  const [over, setOver] = useState(null)

  const drop = (e, status) => {
    e.preventDefault()
    setOver(null)
    const id = Number(e.dataTransfer.getData('text/plain'))
    const item = items.find(i => i.id === id)
    if (item && item.status !== status) onStatus(item, status)
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {ITEM_STATUSES.map(col => {
        const cards = items.filter(i => i.status === col.value)
        return (
          <section
            key={col.value}
            aria-label={col.label}
            className="rounded-xl p-2.5 flex flex-col gap-2"
            style={{
              background: 'var(--adm-board-sunk)',
              border: `1px dashed ${over === col.value ? 'var(--adm-signal)' : 'transparent'}`,
              minHeight: 160,
            }}
            onDragOver={e => { e.preventDefault(); setOver(col.value) }}
            onDragLeave={() => setOver(o => (o === col.value ? null : o))}
            onDrop={e => drop(e, col.value)}
          >
            <header className="flex items-center justify-between px-1.5 pt-0.5">
              <h3 className="text-[13px] font-semibold">{col.label}</h3>
              <span className="adm-data text-[11px]" style={{ color: 'var(--adm-silk-faint)' }}>{cards.length}</span>
            </header>
            {cards.map(item => {
              const dept = deptById.get(item.department_id)
              return (
                <article
                  key={item.id}
                  draggable
                  onDragStart={e => e.dataTransfer.setData('text/plain', String(item.id))}
                  className="adm-panel p-3 cursor-grab"
                  style={{ opacity: item.status === 'cancelled' ? 0.6 : 1 }}
                >
                  <button type="button" className="text-left text-[13.5px] font-semibold block w-full adm-truncate" onClick={() => onOpen(item)} title="History">
                    {item.name}
                  </button>
                  <p className="adm-data text-[12px] mt-0.5" style={{ color: 'var(--adm-silk-dim)' }}>
                    {item.quantity}{item.unit ? ` ${item.unit}` : ''} · {kindLabel(item.kind)}
                  </p>
                  <div className="flex items-center gap-1.5 mt-2 text-[11.5px]" style={{ color: 'var(--adm-silk-faint)' }}>
                    {dept && <span className="rounded-full" style={{ width: 7, height: 7, background: dept.color || 'var(--adm-silk-faint)' }} />}
                    <span className="adm-truncate">{dept?.name || 'No department'}{item.assignee ? ` · ${item.assignee}` : ''}</span>
                  </div>
                  <select className="adm-input adm-cell-select mt-2" aria-label={`Status of ${item.name}`} value={item.status}
                    onChange={e => onStatus(item, e.target.value)}>
                    {ITEM_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </article>
              )
            })}
          </section>
        )
      })}
    </div>
  )
}
