import { supabaseAdmin, sanitizeFilter } from '../db/client.js'

export async function searchEvents(query) {
  const safe = sanitizeFilter(query)
  if (!safe) return []

  const { data, error } = await supabaseAdmin
    .from('events')
    .select('*')
    .eq('is_published', true)
    .or(`title_en.ilike.%${safe}%,title_ar.ilike.%${safe}%,title_fr.ilike.%${safe}%,description_en.ilike.%${safe}%,description_ar.ilike.%${safe}%,description_fr.ilike.%${safe}%`)
    .order('date', { ascending: true })
    .limit(10)

  if (error) {
    console.error('searchEvents error:', error)
    return []
  }
  return data || []
}

export async function getUpcomingEvents(limit = 5) {
  const today = new Date().toISOString().split('T')[0]
  const { data, error } = await supabaseAdmin
    .from('events')
    .select('*')
    .eq('is_published', true)
    .gte('date', today)
    .order('date', { ascending: true })
    .limit(limit)

  if (error) {
    console.error('getUpcomingEvents error:', error)
    return []
  }
  return data || []
}

export async function getAllPublishedEvents() {
  const { data, error } = await supabaseAdmin
    .from('events')
    .select('*')
    .eq('is_published', true)
    .order('date', { ascending: true })
    .limit(10)

  if (error) {
    console.error('getAllPublishedEvents error:', error)
    return []
  }
  return data || []
}
