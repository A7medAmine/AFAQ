import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { logActivity, run, supabase } from '../../lib/db'
import { isLowStock } from '../../lib/inventoryImport'
import { onShelf, restockSuggestion } from '../../lib/needs'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import EmptyState from '../ui/EmptyState'

/**
 * Inventory items at or under their minimum stock, offered as lines to buy.
 * Nothing is added on its own: logistics ticks what this list should cover.
 */
export default function LowStockModal({ open, inventory, items, departments, list, onClose, onAdded }) {
  const [rows, setRows] = useState([])
  const [deptId, setDeptId] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    const already = new Set(items.filter(i => i.status !== 'cancelled').map(i => i.inventory_item_id).filter(Boolean))
    setRows(inventory.filter(i => isLowStock(i) && !already.has(i.id)).map(i => ({ inv: i, on: true, qty: String(restockSuggestion(i)) })))
    setDeptId(list.scope === 'department' && list.department_id ? String(list.department_id) : '')
  }, [open, inventory, items, list])

  const set = (id, changes) => setRows(rs => rs.map(r => (r.inv.id === id ? { ...r, ...changes } : r)))
  const picked = rows.filter(r => r.on && Number(r.qty) > 0)

  const add = async () => {
    setBusy(true)
    const { ok } = await run(
      supabase.from('need_items').insert(picked.map(r => ({
        list_id: list.id, name: r.inv.name, quantity: Math.ceil(Number(r.qty)), inventory_item_id: r.inv.id,
        kind: r.inv.tracking_mode === 'consumable' ? 'consumable' : 'equipment', source: 'buy', status: 'needed', priority: 'must',
        department_id: deptId ? Number(deptId) : null, notes: `Low stock: ${onShelf(r.inv)} left, minimum ${r.inv.min_stock}.`,
      }))),
      { success: `Added ${picked.length} item${picked.length === 1 ? '' : 's'} to restock.`, failure: 'Nothing was added.' }
    )
    setBusy(false)
    if (!ok) return
    logActivity('created', 'need_items', null, { name: 'Low stock restock', list: list.title, count: picked.length })
    onAdded()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Restock low items"
      description="Inventory items at or under their minimum. Quantities bring each back to twice its minimum; change them as needed."
      footer={
        <>
          <Button onClick={onClose} data-dialog-dismiss="true">Cancel</Button>
          <Button variant="primary" icon={Plus} onClick={add} busy={busy} busyLabel="Adding…" disabled={!picked.length}>Add {picked.length} to the list</Button>
        </>
      }
    >
      {rows.length === 0 ? (
        <EmptyState compact title="Nothing is low" description="No inventory item is at or under its minimum, or they are already on this list." />
      ) : (
        <div className="space-y-3">
          <label className="block" style={{ maxWidth: 260 }}>
            <span className="adm-label">Department</span>
            <select className="adm-input" value={deptId} onChange={e => setDeptId(e.target.value)}>
              <option value="">None</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          <div className="adm-scroll overflow-auto rounded-xl" style={{ maxHeight: 340, border: '1px solid var(--adm-trace)' }}>
            <table className="adm-table">
              <thead><tr><th style={{ width: 36 }} /><th>Item</th><th>On the shelf</th><th>Minimum</th><th>Buy</th></tr></thead>
              <tbody>
                {rows.map(({ inv, on, qty }) => (
                  <tr key={inv.id}>
                    <td><input type="checkbox" className="adm-check" aria-label={`Restock ${inv.name}`} checked={on} onChange={e => set(inv.id, { on: e.target.checked })} /></td>
                    <td className="text-sm font-semibold">{inv.name}<span className="adm-data block text-[11px] font-normal" style={{ color: 'var(--adm-silk-faint)' }}>{inv.asset_code}</span></td>
                    <td className="adm-data text-[13px]" style={{ color: 'var(--adm-fault)' }}>{onShelf(inv)}</td>
                    <td className="adm-data text-[13px]">{inv.min_stock}</td>
                    <td><input className="adm-input adm-cell-input adm-data" style={{ width: 70 }} type="number" min={1} aria-label={`How many ${inv.name} to buy`}
                      value={qty} onChange={e => set(inv.id, { qty: e.target.value })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  )
}
