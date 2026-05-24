function formatClubInfo(clubInfo) {
  if (!clubInfo || clubInfo.length === 0) return ''
  return clubInfo.map(c =>
    `- ${c.labelEn}: ${c.valueEn}`
  ).join('\n')
}

function formatEvents(events) {
  if (!events || events.length === 0) return ''
  return events.map((e) =>
    `- ${e.titleEn || ''}${e.date ? ` (${e.date})` : ''}${e.locationEn ? ` @ ${e.locationEn}` : ''}${e.descriptionEn ? `: ${e.descriptionEn.slice(0, 200)}` : ''}`
  ).join('\n')
}

function formatAnnouncements(announcements) {
  if (!announcements || announcements.length === 0) return ''
  return announcements.map((a) =>
    `- ${a.titleEn || ''}${a.contentEn ? `: ${a.contentEn.slice(0, 200)}` : ''}`
  ).join('\n')
}

function formatProjects(projects) {
  if (!projects || projects.length === 0) return ''
  return projects.map((p) =>
    `- ${p.titleEn || ''}${p.category ? ` [${p.category}]` : ''}${p.descriptionEn ? `: ${p.descriptionEn.slice(0, 200)}` : ''}`
  ).join('\n')
}

function formatFaqs(faqs) {
  if (!faqs || faqs.length === 0) return ''
  return faqs.map((f) =>
    `Q: ${f.questionEn || ''}\nA: ${f.answerEn || ''}`
  ).join('\n\n')
}

export function buildContext(data) {
  const parts = []

  if (data.clubInfo && data.clubInfo.length > 0) {
    parts.push('=== ABOUT THE CLUB ===\n' + formatClubInfo(data.clubInfo))
  }

  if (data.events && data.events.length > 0) {
    parts.push('=== UPCOMING EVENTS ===\n' + formatEvents(data.events))
  }

  if (data.announcements && data.announcements.length > 0) {
    parts.push('=== ANNOUNCEMENTS ===\n' + formatAnnouncements(data.announcements))
  }

  if (data.projects && data.projects.length > 0) {
    parts.push('=== PROJECTS ===\n' + formatProjects(data.projects))
  }

  if (data.faqs && data.faqs.length > 0) {
    parts.push('=== FREQUENTLY ASKED QUESTIONS ===\n' + formatFaqs(data.faqs))
  }

  return parts.join('\n\n')
}
