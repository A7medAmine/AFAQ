import { useEffect, useState } from 'react'
import { Paperclip, X } from 'lucide-react'
import { logActivity, run, supabase, uploadFile } from '../../lib/db'
import useAdminStore from '../../store/adminStore'
import { toDateInput } from '../../lib/format'
import { PAYMENT_METHODS, categoriesFor } from '../../lib/finance'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { FilterTabs } from '../ui/PageHeader'
import { SelectField, TextArea, TextField } from '../ui/Field'

/**
 * Record one income or expense. `defaults` pre-fills a new row — a budget card
 * opens this with its event or project already chosen.
 *
 * @param events    [{ id, title_en }]
 * @param projects  [{ id, title_en }]
 */
export default function TransactionModal({
  open, transaction, defaults = {}, events = [], projects = [], onClose, onSaved,
}) {
  const editing = !!transaction
  const userId = useAdminStore(s => s.adminProfile?.user_id)
  const [form, setForm] = useState({})
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(0)

  useEffect(() => {
    if (!open) return
    const src = transaction || defaults
    const kind = src.kind || 'expense'
    setForm({
      kind,
      category: src.category || categoriesFor(kind)[0].value,
      amount: src.amount != null ? String(Number(src.amount)) : '',
      occurred_on: src.occurred_on || toDateInput(),
      description: src.description || '',
      counterparty: src.counterparty || '',
      payment_method: src.payment_method || 'cash',
      reference: src.reference || '',
      receipt_url: src.receipt_url || '',
      event_id: src.event_id ? String(src.event_id) : '',
      project_id: src.project_id ? String(src.project_id) : '',
    })
    setErrors({})
  }, [open, transaction]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (key, value) => {
    setForm(f => ({ ...f, [key]: value }))
    setErrors(e => ({ ...e, [key]: undefined }))
  }

  // Switching kind resets the category — "Sponsorship" is not an expense.
  const setKind = kind => setForm(f => ({
    ...f,
    kind,
    category: categoriesFor(kind).some(c => c.value === f.category) ? f.category : categoriesFor(kind)[0].value,
  }))

  const attach = async file => {
    if (!file) return
    setUploading(1)
    try {
      const url = await uploadFile(file, pct => setUploading(Math.max(1, pct)))
      set('receipt_url', url)
    } catch (err) {
      setErrors(e => ({ ...e, receipt_url: err.message }))
    }
    setUploading(0)
  }

  const submit = async () => {
    const amount = Number(form.amount)
    const next = {}
    if (!form.amount || !Number.isFinite(amount) || amount <= 0) next.amount = 'Enter an amount above zero.'
    if (!form.occurred_on) next.occurred_on = 'Pick the date it happened.'
    if (Object.keys(next).length) { setErrors(next); return }

    const payload = {
      kind: form.kind,
      category: form.category,
      amount: Math.round(amount * 100) / 100,
      occurred_on: form.occurred_on,
      description: form.description.trim() || null,
      counterparty: form.counterparty.trim() || null,
      payment_method: form.payment_method || null,
      reference: form.reference.trim() || null,
      receipt_url: form.receipt_url || null,
      event_id: form.event_id ? Number(form.event_id) : null,
      project_id: form.project_id ? Number(form.project_id) : null,
      updated_at: new Date().toISOString(),
    }

    setSaving(true)
    const query = editing
      ? supabase.from('finance_transactions').update(payload).eq('id', transaction.id)
      : supabase.from('finance_transactions').insert({ ...payload, created_by: userId || null })
    const { ok, data } = await run(query.select('*').single(), {
      success: editing ? 'Transaction updated.' : 'Transaction recorded.',
      failure: 'The transaction did not save.',
    })
    setSaving(false)
    if (!ok) return
    logActivity(editing ? 'updated' : 'created', 'finance_transactions', data.id, {
      name: data.description || data.category, kind: data.kind, amount: data.amount,
    })
    onSaved(data)
    onClose()
  }

  const categories = categoriesFor(form.kind)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit transaction' : 'New transaction'}
      footer={
        <>
          <Button onClick={onClose} data-dialog-dismiss="true">Cancel</Button>
          <Button variant="primary" onClick={submit} busy={saving} busyLabel="Saving…" disabled={uploading > 0}>
            {editing ? 'Save changes' : 'Record'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FilterTabs
          label="Transaction kind"
          value={form.kind}
          onChange={setKind}
          options={[{ value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' }]}
        />
        <div className="grid sm:grid-cols-2 gap-4">
          <TextField label="Amount (DA)" required type="number" min="0" step="0.01" inputMode="decimal"
            value={form.amount || ''} error={errors.amount} onChange={e => set('amount', e.target.value)} />
          <TextField label="Date" required type="date" value={form.occurred_on || ''} error={errors.occurred_on}
            onChange={e => set('occurred_on', e.target.value)} />
          <SelectField label="Category" value={form.category || ''} onChange={e => set('category', e.target.value)}>
            {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </SelectField>
          <SelectField label="Paid by" value={form.payment_method || ''} onChange={e => set('payment_method', e.target.value)}>
            {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </SelectField>
          <TextField label={form.kind === 'income' ? 'From' : 'Paid to'} value={form.counterparty || ''}
            onChange={e => set('counterparty', e.target.value)}
            placeholder={form.kind === 'income' ? 'Sponsor, donor…' : 'Vendor, shop…'} />
          <TextField label="Reference" value={form.reference || ''} onChange={e => set('reference', e.target.value)}
            placeholder="Invoice / receipt no." />
          <SelectField label="Event" value={form.event_id || ''}
            onChange={e => { set('event_id', e.target.value); if (e.target.value) set('project_id', '') }}>
            <option value="">No event</option>
            {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title_en}</option>)}
          </SelectField>
          <SelectField label="Project" value={form.project_id || ''}
            onChange={e => { set('project_id', e.target.value); if (e.target.value) set('event_id', '') }}>
            <option value="">No project</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.title_en}</option>)}
          </SelectField>
        </div>
        <TextArea label="Description" rows={2} value={form.description || ''}
          onChange={e => set('description', e.target.value)} placeholder="Arduino kits for the robotics workshop" />

        <div>
          <span className="adm-label">Receipt</span>
          {form.receipt_url ? (
            <div className="flex items-center gap-2 text-[13px]">
              <a href={form.receipt_url} target="_blank" rel="noreferrer" className="font-semibold"
                style={{ color: 'var(--adm-signal)' }}>View receipt</a>
              <button type="button" onClick={() => set('receipt_url', '')} aria-label="Remove receipt"
                style={{ color: 'var(--adm-silk-faint)' }}><X size={14} /></button>
            </div>
          ) : (
            <label className="inline-flex items-center gap-2 text-[13px] font-semibold cursor-pointer"
              style={{ color: 'var(--adm-silk-dim)' }}>
              <Paperclip size={14} />
              {uploading ? `Uploading… ${uploading}%` : 'Attach a photo of the receipt'}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only"
                disabled={uploading > 0} onChange={e => attach(e.target.files?.[0])} />
            </label>
          )}
          {errors.receipt_url && (
            <p className="mt-1.5 text-xs" style={{ color: 'var(--adm-fault)' }}>{errors.receipt_url}</p>
          )}
        </div>
      </div>
    </Modal>
  )
}
