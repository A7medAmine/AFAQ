/**
 * Asset codes count up with no gaps: a new item takes the number after the
 * highest code in use, not its row id (ids skip after deletes and failed
 * inserts, which made codes jump from INV-00007 to INV-00034).
 */

import QRCode from 'qrcode'
import { supabase } from './db'
import useAdminStore from '../store/adminStore'

const PREFIX = 'INV-'
export const assetCode = n => `${PREFIX}${String(n).padStart(5, '0')}`

async function highestNumber() {
  // Codes are zero-padded, so text order is number order.
  const { data, error } = await supabase
    .from('inventory_items').select('asset_code')
    .like('asset_code', `${PREFIX}%`)
    .order('asset_code', { ascending: false }).limit(1)
  if (error) throw error
  return Number(data?.[0]?.asset_code?.slice(PREFIX.length)) || 0
}

/**
 * Gives the item the next free code and its QR. Two people adding at once can
 * pick the same number; the unique index rejects one, and it tries the next.
 * Returns the code, or null if it couldn't be saved.
 */
export async function labelItem(id) {
  try {
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = assetCode(await highestNumber() + 1)
      const qrCode = await QRCode.toDataURL(code, { width: 300, margin: 2 })
      const { error } = await supabase.from('inventory_items').update({ asset_code: code, qr_code: qrCode }).eq('id', id)
      if (!error) return code
      if (error.code !== '23505') throw error
    }
    throw new Error('Could not find a free asset code.')
  } catch (err) {
    useAdminStore.getState().addToast(`The item was saved but has no asset code yet: ${err.message}`, 'error')
    return null
  }
}
