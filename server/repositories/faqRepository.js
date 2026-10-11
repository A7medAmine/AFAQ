import { supabaseAdmin } from '../db/client.js'

export async function getAllFaqs(limit = 100) {
  const { data, error } = await supabaseAdmin
    .from('faq')
    .select('*')
    .eq('is_published', true)
    .order('sort_order', { ascending: true })
    .limit(limit)

  if (error) {
    console.error('getAllFaqs error:', error)
    return []
  }
  return data || []
}
