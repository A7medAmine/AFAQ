import { supabaseAdmin } from '../db/client.js'
import { getAllFaqs } from './faqRepository.js'
import { getEventsForAssistant } from './eventsRepository.js'
import { getRecentAnnouncements } from './announcementsRepository.js'
import { getAllPublishedProjects } from './projectsRepository.js'
import { getPublishedKnowledge } from './aiKnowledgeRepository.js'

async function safeSearch(fn, fallback = []) {
  try { return await fn() } catch (e) { console.error('Search error:', e.message); return fallback }
}

async function getActiveLinks() {
  const { data, error } = await supabaseAdmin
    .from('social_links')
    .select('label, url, platform')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data || []
}

// The club's data is small enough to hand the assistant all of it, which beats
// keyword search: questions rarely share exact words with the stored text.
export async function getAllClubInfo() {
  const [faqs, events, announcements, projects, knowledge, links] = await Promise.all([
    safeSearch(() => getAllFaqs()),
    safeSearch(() => getEventsForAssistant()),
    safeSearch(() => getRecentAnnouncements()),
    safeSearch(() => getAllPublishedProjects()),
    safeSearch(() => getPublishedKnowledge()),
    safeSearch(() => getActiveLinks()),
  ])
  return { faqs, events, announcements, projects, knowledge, links }
}
