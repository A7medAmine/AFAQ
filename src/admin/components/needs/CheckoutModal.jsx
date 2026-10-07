import { useEffect, useState } from 'react'
import { ArrowLeftRight } from 'lucide-react'
import { logActivity, run, supabase } from '../../lib/db'
import { onShelf } from '../../lib/needs'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { TextField } from '../ui/Field'

/** End of the picked day, local time, like Borrowing's due dates. */
const endOfDay = day => new Date(`${day}T23:59:59`).toISOString()

/**
 * Take the "from stock" lines out of inventory in one Borrowing check-out:
 * equipment is lent and comes back through Borrowing → Return, consumables
 * are handed out for good. Every line goes or none does.
 */
export default function CheckoutModal({ open, items, stock, list, onClose, onDone }) {
  const [rows, setRows] = useState([])
  const [borrower, setBorrower] = useState('')
  const [due, setDue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setRows(items.map(i => {
      const inv = stock.get(i.inventory_item_id)
      return { item: i, inv, on: !!inv && onShelf(inv) >= i.quantity, kind: i.kind === 'consumable' || inv?.tracking_mode === 'consumable' ? 'issue' : 'loan' }
    }))
    setBorrower(list.department?.name ? `${list.department.name} team` : list.title)
    setDue(list.event?.date || list.due_date || '')
  }, [open, items, stock, list])

  const set = (id, changes) => setRows(rs => rs.map(r => (r.item.id === id ? { ...r, ...changes } : r)))
  const picked = rows.filter(r => r.on && r.inv)
  const lending = picked.some(r => r.kind === 'loan')

  const checkout = async () => {
    if (!borrower.trim()) { setError('Say who takes them.'); return }
    setBusy(true)
    setError(null)
    const { ok, data, error: rpcError } = await run(
      supabase.rpc('inventory_checkout', {
        p_lines: picked.map(r => ({ item_id: r.inv.id, quantity: r.item.quantity, kind: r.kind })),
        p_member: null,
        p_borrower: borrower.trim(),
        p_purpose: list.title,
        p_due: lending && due ? endOfDay(due) : null,
        p_note: 'Checked out from a needs list',
      }),
      { failure: 'Nothing was checked out.' }
    )
    if (!ok) {
      const short = /not_enough:(\d+)/.exec(rpcError?.message || '')
      if (short) setError(`Not enough of ${rows.find(r => r.inv?.id === Number(short[1]))?.item.name || 'one item'} on the shelf any more.`)
      setBusy(false)
      return
    }
    const ids = picked.map(r => r.item.id)
    await run(
      supabase.from('need_items').update({ borrow_batch_id: data, status: 'ready', updated_at: new Date().toISOString() }).in('id', ids),
      { failure: 'The items left stock but the list did not record it.' }
    )
    logActivity('updated', 'need_items', null, { name: 'Checked out from stock', list: list.title, count: ids.length, batch_id: data })
    setBusy(false)
    onDone(ids.length)
  }

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      size="lg"
      title="Check out from stock"
      description="Takes these items out of inventory through Borrowing. Lent equipment comes back through Borrowing → Return."
      footer={
        <>
          <Button onClick={onClose} disabled={busy} data-dialog-dismiss="true">Cancel</Button>
          <Button variant="primary" icon={ArrowLeftRight} onClick={checkout} busy={busy} busyLabel="Checking out…" disabled={!picked.length}>
            Check out {picked.length}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="adm-scroll overflow-auto rounded-xl" style={{ maxHeight: 320, border: '1px solid var(--adm-trace)' }}>
          <table className="adm-table">
            <thead><tr><th style={{ width: 36 }} /><th>Item</th><th>Qty</th><th>On the shelf</th><th>How</th></tr></thead>
            <tbody>
              {rows.map(({ item, inv, on, kind }) => {
                const shelf = inv ? onShelf(inv) : 0
                const enough = shelf >= item.quantity
                return (
                  <tr key={item.id}>
                    <td><input type="checkbox" className="adm-check" aria-label={`Check out ${item.name}`} checked={on} disabled={!inv || !enough}
                      onChange={e => set(item.id, { on: e.target.checked })} /></td>
                    <td className="text-sm font-semibold">{item.name}<span className="adm-data block text-[11px] font-normal" style={{ color: 'var(--adm-silk-faint)' }}>{inv?.asset_code}</span></td>
                    <td className="adm-data text-[13px]">{item.quantity}</td>
                    <td className="adm-data text-[13px]" style={{ color: enough ? undefined : 'var(--adm-fault)' }}>{inv ? shelf : 'Not in inventory'}</td>
                    <td>
                      <select className="adm-input adm-cell-select" aria-label={`How ${item.name} goes out`} value={kind} onChange={e => set(item.id, { kind: e.target.value })}>
                        <option value="loan">Lend, comes back</option>
                        <option value="issue">Hand out for good</option>
                      </select>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <TextField label="Taken by" required value={borrower} onChange={e => setBorrower(e.target.value)} placeholder="Tech team, Sara…" />
          {lending && <TextField label="Back by" type="date" value={due} onChange={e => setDue(e.target.value)} hint="For lent items. Optional." />}
        </div>
        {error && <p className="text-sm" style={{ color: 'var(--adm-fault)' }}>{error}</p>}
      </div>
    </Modal>
  )
}
