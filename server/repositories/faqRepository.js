import { supabaseAdmin, sanitizeFilter } from '../db/client.js'

export async function searchFaqs(query) {
  const safe = sanitizeFilter(query)
  if (!safe) return []

  const { data, error } = await supabaseAdmin
    .from('faq')
    .select('*')
    .eq('is_published', true)
    .or(`question_en.ilike.%${safe}%,question_ar.ilike.%${safe}%,question_fr.ilike.%${safe}%,answer_en.ilike.%${safe}%,answer_ar.ilike.%${safe}%,answer_fr.ilike.%${safe}%`)
    .order('sort_order', { ascending: true })
    .limit(10)

  if (error) {
    console.error('searchFaqs error:', error)
    return []
  }
  return data || []
}

export async function getAllFaqs() {
  const { data, error } = await supabaseAdmin
    .from('faq')
    .select('*')
    .eq('is_published', true)
    .order('sort_order', { ascending: true })
    .limit(10)

  if (error) {
    console.error('getAllFaqs error:', error)
    return []
  }
  return data || []
}
