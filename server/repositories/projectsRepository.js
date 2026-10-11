import { supabaseAdmin } from '../db/client.js'

export async function getAllPublishedProjects(limit = 60) {
  const { data, error } = await supabaseAdmin
    .from('projects')
    .select('id, title_en, title_ar, title_fr, description_en, description_ar, description_fr, category, technologies, github_url, demo_url, created_at')
    .eq('is_published', true)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('getAllPublishedProjects error:', error)
    return []
  }
  return data || []
}
