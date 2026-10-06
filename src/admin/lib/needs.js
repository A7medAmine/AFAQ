import { read, run, supabase } from './db'

/**
 * Vocabulary for needs lists. The values are what the database stores (see
 * the CHECK constraints in migration 0024); labels are the console's English.
 * Printed lists translate them through exportI18n.
 */

export const LIST_SCOPES = [
  { value: 'event', label: 'For an event' },
  { value: 'department', label: 'For a department' },
  { value: 'custom', label: 'Custom list' },
]

export const LIST_STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'done', label: 'Done' },
  { value: 'archived', label: 'Archived' },
]

export const KINDS = [
  { value: 'equipment', label: 'Equipment' },
  { value: 'consumable', label: 'Consumable' },
  { value: 'other', label: 'Other' },
]

/** Where the thing will come from. */
export const SOURCES = [
  { value: 'stock', label: 'From stock' },
  { value: 'buy', label: 'Buy' },
  { value: 'borrow', label: 'Borrow' },
  { value: 'make', label: 'Make' },
]

/** needed → ordered → ready; cancelled drops it from the count. */
export const ITEM_STATUSES = [
  { value: 'needed', label: 'Needed', tone: 'wait' },
  { value: 'ordered', label: 'Ordered', tone: 'signal' },
  { value: 'ready', label: 'Ready', tone: 'ok' },
  { value: 'cancelled', label: 'Dropped', tone: 'neutral' },
]

export const PRIORITIES = [
  { value: 'must', label: 'Must have' },
  { value: 'nice', label: 'Nice to have' },
]

export const UNITS = ['pcs', 'box', 'pack', 'm', 'roll', 'kg', 'L', 'set', 'pair', 'sheet']

export const DEPARTMENT_COLORS = ['#2563eb', '#db2777', '#d97706', '#059669', '#7c3aed', '#dc2626', '#0891b2', '#4b5563']

const labelOf = list => value => list.find(o => o.value === value)?.label || value || '—'
export const kindLabel = labelOf(KINDS)
export const sourceLabel = labelOf(SOURCES)
export const itemStatusLabel = labelOf(ITEM_STATUSES)
export const priorityLabel = labelOf(PRIORITIES)
export const scopeLabel = labelOf(LIST_SCOPES)

/** Ready out of everything still wanted; dropped lines don't count. */
export function progressOf(items) {
  const live = items.filter(i => i.status !== 'cancelled')
  const ready = live.filter(i => i.status === 'ready').length
  return { total: live.length, ready, open: live.length - ready, pct: live.length ? Math.round((ready / live.length) * 100) : 0 }
}

/** Units on the shelf right now. */
export const onShelf = item => Math.max(0, (item.quantity ?? 1) - (item.on_loan || 0))

/** A due date (YYYY-MM-DD) is late once that whole day has passed. */
export const isLate = list =>
  list.status === 'open' && !!list.due_date && new Date(`${list.due_date}T23:59:59`).getTime() < Date.now()

/** "Open week 2026 · Tech" — what a list is for, in a word or two. */
export function listContext(list) {
  if (list.scope === 'event') return list.event?.title_en || 'Event'
  if (list.scope === 'department') return list.department?.name || 'Department'
  return 'Custom'
}

export function loadDepartments() {
  return read(supabase.from('departments').select('*').order('sort_order').order('name'))
}

/**
 * Copies a list and its lines into a new open list, every line back to
 * "needed" — for needs that come round again, like each year's open week.
 */
export async function duplicateList(list, items, title) {
  const { ok, data } = await run(
    supabase.from('need_lists').insert({
      title, scope: list.scope, event_id: list.event_id, department_id: list.department_id,
      notes: list.notes, status: 'open',
    }).select('id').single(),
    { failure: 'The copy was not made.' }
  )
  if (!ok) return null
  if (items.length) {
    const copied = items.filter(i => i.status !== 'cancelled').map(i => ({
      list_id: data.id, department_id: i.department_id, kind: i.kind, name: i.name, quantity: i.quantity,
      unit: i.unit, inventory_item_id: i.inventory_item_id, source: i.source, priority: i.priority,
      assignee: i.assignee, notes: i.notes, status: 'needed',
    }))
    const res = await run(supabase.from('need_items').insert(copied), { failure: 'The list was copied without its items.' })
    if (!res.ok) return data.id
  }
  return data.id
}
