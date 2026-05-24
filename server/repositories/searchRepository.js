import { searchFaqs, getAllFaqs } from './faqRepository.js'
import { searchEvents, getAllPublishedEvents } from './eventsRepository.js'
import { searchAnnouncements, getRecentAnnouncements } from './announcementsRepository.js'
import { searchProjects, getAllPublishedProjects } from './projectsRepository.js'
import { searchKnowledge, getPublishedKnowledge } from './aiKnowledgeRepository.js'

async function safeSearch(fn, fallback = []) {
  try { return await fn() } catch (e) { console.error('Search error:', e.message); return fallback }
}

export async function searchAll(query) {
  const [faqs, events, announcements, projects, knowledge] = await Promise.all([
    safeSearch(() => searchFaqs(query)),
    safeSearch(() => searchEvents(query)),
    safeSearch(() => searchAnnouncements(query)),
    safeSearch(() => searchProjects(query)),
    safeSearch(() => searchKnowledge(query)),
  ])
  return { faqs, events, announcements, projects, knowledge }
}

export async function getAllClubInfo() {
  const [faqs, events, announcements, projects, knowledge] = await Promise.all([
    safeSearch(() => getAllFaqs()),
    safeSearch(() => getAllPublishedEvents()),
    safeSearch(() => getRecentAnnouncements()),
    safeSearch(() => getAllPublishedProjects()),
    safeSearch(() => getPublishedKnowledge()),
  ])
  return { faqs, events, announcements, projects, knowledge }
}
