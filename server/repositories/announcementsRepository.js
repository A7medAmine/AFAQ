import { supabaseAdmin } from '../db/client.js'

export async function getRecentAnnouncements(limit = 8) {
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
