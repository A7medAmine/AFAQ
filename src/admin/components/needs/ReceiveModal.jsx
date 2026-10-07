import { useEffect, useState } from 'react'
import { PackagePlus } from 'lucide-react'
import { logActivity, run, supabase } from '../../lib/db'
import { CATEGORIES } from '../../lib/inventoryImport'
import { loadShelves } from '../../lib/shelves'
import { labelItem } from '../../lib/assetCodes'
import Modal from '../ui/Modal'
import Button from '../ui/Button'

const categoryFor = item => (item.kind === 'consumable' ? 'Consumables' : 'Other')

/**
 * Things that were bought or made have arrived: put them in inventory. A line
 * linked to an inventory item tops up its count; anything else becomes a new
 * item with its own asset code and QR label. Either way the line remembers it
 * was stocked, so it is never added twice.
 */
export default function ReceiveModal({ open, items, list, onClose, onDone }) {
  const [rows, setRows] = useState([])
  const [shelves, setShelves] = useState([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setRows(items.map(i => ({ item: i, on: true, category: categoryFor(i), location: '' })))
    loadShelves().then(({ ok, data }) => setShelves(ok ? data || [] : []))
  }, [open, items])

  const set = (id, changes) => setRows(rs => rs.map(r => (r.item.id === id ? { ...r, ...changes } : r)))
  const picked = rows.filter(r => r.on)

  const receive = async () => {
    setBusy(true)
    let done = 0
    let failed = 0
    for (const { item, category, location } of picked) {
      let inventoryId = item.inventory_item_id
      if (inventoryId) {
        const { ok } = await run(supabase.rpc('inventory_restock', { p_item: inventoryId, p_qty: item.quantity }),
          { failure: `${item.name} was not added to its stock.` })
        if (!ok) { failed++; continue }
      } else {
        const { ok, data } = await run(
          supabase.from('inventory_items').insert({
            name: item.name, category, quantity: item.quantity, condition: 'new', status: 'available',
            tracking_mode: item.kind === 'consumable' ? 'consumable' : 'returnable',
            location: location || null, notes: `From the needs list “${list.title}”.`,
          }).select('id').single(),
          { failure: `${item.name} was not added to inventory.` }
        )
        if (!ok) { failed++; continue }
        inventoryId = data.id
        await labelItem(inventoryId)
      }
      const { ok } = await run(
        supabase.from('need_items').update({ inventory_item_id: inventoryId, stocked_at: new Date().toISOString() }).eq('id', item.id),
        { failure: `${item.name} is in inventory but the list did not record it.` }
      )
      if (ok) {
        done++
        logActivity('updated', 'need_items', item.id, { name: item.name, list: list.title, stocked: item.quantity, inventory_item_id: inventoryId })
      } else failed++
    }
    setBusy(false)
    onDone({ done, failed })
  }

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      size="lg"
      title={items.length === 1 ? `Add ${items[0]?.name} to inventory?` : 'Add arrived items to inventory'}
      description="Items already in inventory get their count raised; new ones get an asset code and a QR label."
      footer={
        <>
          <Button onClick={onClose} disabled={busy} data-dialog-dismiss="true">{items.length === 1 ? 'Not now' : 'Cancel'}</Button>
          <Button variant="primary" icon={PackagePlus} onClick={receive} busy={busy} busyLabel="Adding…" disabled={!picked.length}>
            Add {picked.length} to inventory
          </Button>
        </>
      }
    >
      <div className="adm-scroll overflow-auto rounded-xl" style={{ maxHeight: 380, border: '1px solid var(--adm-trace)' }}>
        <table className="adm-table">
          <thead><tr><th style={{ width: 36 }} /><th>Item</th><th>Qty</th><th>Goes to</th></tr></thead>
          <tbody>
            {rows.map(({ item, on, category, location }) => (
              <tr key={item.id}>
                <td><input type="checkbox" className="adm-check" aria-label={`Add ${item.name}`} checked={on} onChange={e => set(item.id, { on: e.target.checked })} /></td>
                <td className="text-sm font-semibold">{item.name}</td>
                <td className="adm-data text-[13px]">{item.quantity}{item.unit ? ` ${item.unit}` : ''}</td>
                <td>
                  {item.inventory_item_id ? (
                    <span className="text-[13px]" style={{ color: 'var(--adm-ok)' }}>Tops up the linked inventory item</span>
                  ) : (
                    <span className="flex flex-wrap gap-1.5">
                      <select className="adm-input adm-cell-select" aria-label="Category" value={category} onChange={e => set(item.id, { category: e.target.value })}>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <select className="adm-input adm-cell-select" aria-label="Shelf" value={location} onChange={e => set(item.id, { location: e.target.value })}>
                        <option value="">No shelf</option>
                        {shelves.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                      </select>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  )
}
