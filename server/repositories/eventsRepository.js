import { db } from '../db/client.js'
import { events } from '../../src/db/schema.js'
import { like, or, and, eq, gte } from 'drizzle-orm'

export async function searchEvents(query) {
  return db.select().from(events).where(
    and(
      eq(events.isPublished, true),
      or(
        like(events.titleEn, `%${query}%`),
        like(events.titleAr, `%${query}%`),
        like(events.titleFr, `%${query}%`),
        like(events.descriptionEn, `%${query}%`),
        like(events.descriptionAr, `%${query}%`),
        like(events.descriptionFr, `%${query}%`),
      ),
    ),
  ).orderBy(events.date).limit(10)
}

export async function getUpcomingEvents(limit = 5) {
  return db.select().from(events).where(
    and(eq(events.isPublished, true), gte(events.date, new Date().toISOString().split('T')[0])),
  ).orderBy(events.date).limit(limit)
}

export async function getAllPublishedEvents() {
  return db.select().from(events).where(eq(events.isPublished, true)).orderBy(events.date).limit(10)
}
