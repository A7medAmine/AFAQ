/**
 * Shelves are the places inventory is kept. An item points at its shelf by
 * name (inventory_items.location is text), so renaming a shelf renames it on
 * its items too.
 */

import { read, run, supabase } from './db'

export const shelfCode = id => `SHF-${String(id).padStart(3, '0')}`

export function loadShelves() {
  return read(supabase.from('shelves').select('*').order('name'))
}

/** Insert, then give it a code from its own id — like asset codes. */
export async function createShelf({ name, description }) {
  const { ok, data } = await run(
    supabase.from('shelves').insert({ name: name.trim(), description: description?.trim() || null }).select().single(),
    { failure: 'The shelf was not added. Is that name already used?' }
  )
  if (!ok) return null
  const code = shelfCode(data.id)
  await run(supabase.from('shelves').update({ code }).eq('id', data.id))
  return { ...data, code }
}

export async function updateShelf(shelf, { name, description }) {
  const next = name.trim()
  const { ok } = await run(
    supabase.from('shelves').update({ name: next, description: description?.trim() || null }).eq('id', shelf.id),
    { failure: 'The shelf was not saved. Is that name already used?' }
  )
  if (!ok) return false
  if (next !== shelf.name) {
    await run(
      supabase.from('inventory_items').update({ location: next }).eq('location', shelf.name),
      { failure: 'The shelf was renamed, but its items still show the old name.' }
    )
  }
  return true
}
