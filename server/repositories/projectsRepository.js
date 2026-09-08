import { supabaseAdmin, sanitizeFilter } from '../db/client.js'

export async function searchProjects(query) {
  const safe = sanitizeFilter(query)
  if (!safe) return []

  const { data, error } = await supabaseAdmin
    .from('projects')
    .select('*')
    .eq('is_published', true)
    .or(`title_en.ilike.%${safe}%,title_ar.ilike.%${safe}%,title_fr.ilike.%${safe}%,description_en.ilike.%${safe}%,description_ar.ilike.%${safe}%,description_fr.ilike.%${safe}%`)
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    console.error('searchProjects error:', error)
    return []
  }
  return data || []
}

export async function getAllPublishedProjects() {
  const { data, error } = await supabaseAdmin
    .from('projects')
    .select('*')
    .eq('is_published', true)
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    console.error('getAllPublishedProjects error:', error)
    return []
  }
  return data || []
}
