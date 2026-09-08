import { supabaseAdmin, sanitizeFilter } from '../db/client.js'

export async function searchAnnouncements(query) {
  const safe = sanitizeFilter(query)
  if (!safe) return []

  const { data, error } = await supabaseAdmin
    .from('announcements')
    .select('*')
    .eq('is_published', true)
    .or(`title_en.ilike.%${safe}%,title_ar.ilike.%${safe}%,title_fr.ilike.%${safe}%,content_en.ilike.%${safe}%,content_ar.ilike.%${safe}%,content_fr.ilike.%${safe}%`)
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    console.error('searchAnnouncements error:', error)
    return []
  }
  return data || []
}

export async function getRecentAnnouncements(limit = 5) {
  const { data, error } = await supabaseAdmin
    .from('announcements')
    .select('*')
    .eq('is_published', true)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('getRecentAnnouncements error:', error)
    return []
  }
  return data || []
}
