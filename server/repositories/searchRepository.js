import { searchFaqs, getAllFaqs } from './faqRepository.js'
import { searchEvents, getAllPublishedEvents, getUpcomingEvents } from './eventsRepository.js'
import { searchAnnouncements, getRecentAnnouncements } from './announcementsRepository.js'
import { searchProjects, getAllPublishedProjects } from './projectsRepository.js'
import { searchClubInfo, getAllClubInfo as getAllClubInfoEntries } from './clubInfoRepository.js'

export async function searchAll(query) {
  const [faqs, events, announcements, projects, clubInfo] = await Promise.all([
    searchFaqs(query),
    searchEvents(query),
    searchAnnouncements(query),
    searchProjects(query),
    searchClubInfo(query),
  ])
  return { faqs, events, announcements, projects, clubInfo }
}

export async function getAllClubInfo() {
  const [faqs, events, announcements, projects, clubInfo] = await Promise.all([
    getAllFaqs(),
    getAllPublishedEvents(),
    getRecentAnnouncements(),
    getAllPublishedProjects(),
    getAllClubInfoEntries(),
  ])
  return { faqs, events, announcements, projects, clubInfo }
}
