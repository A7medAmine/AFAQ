import { supabaseAdmin, sanitizeFilter } from '../db/client.js'

export async function searchKnowledge(query) {
  const safe = sanitizeFilter(query)
  if (!safe) return []

  const { data, error } = await supabaseAdmin
    .from('ai_knowledge')
    .select('*')
    .eq('published', true)
    .or(`title.ilike.%${safe}%,content.ilike.%${safe}%,category.ilike.%${safe}%,slug.ilike.%${safe}%`)
    .order('id', { ascending: true })
    .limit(20)

  if (error) throw error
  return data || []
}

export async function getAllKnowledge() {
  const { data, error } = await supabaseAdmin
    .from('ai_knowledge')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function getPublishedKnowledge() {
  const { data, error } = await supabaseAdmin
    .from('ai_knowledge')
    .select('*')
    .eq('published', true)
    .order('id', { ascending: true })

  if (error) throw error
  return data || []
}

export async function getKnowledgeByCategory(category) {
  const { data, error } = await supabaseAdmin
    .from('ai_knowledge')
    .select('*')
    .eq('published', true)
    .eq('category', category)
    .order('id', { ascending: true })

  if (error) throw error
  return data || []
}

export async function createKnowledge(record) {
  const { data, error } = await supabaseAdmin
    .from('ai_knowledge')
    .insert(record)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateKnowledge(id, record) {
  const { data, error } = await supabaseAdmin
    .from('ai_knowledge')
    .update({ ...record, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteKnowledge(id) {
  const { error } = await supabaseAdmin
    .from('ai_knowledge')
    .delete()
    .eq('id', id)

  if (error) throw error
}
