import { db } from '../db/client.js'
import { announcements } from '../../src/db/schema.js'
import { like, or, and, eq } from 'drizzle-orm'

export async function searchAnnouncements(query) {
  return db.select().from(announcements).where(
    and(
      eq(announcements.isPublished, true),
      or(
        like(announcements.titleEn, `%${query}%`),
        like(announcements.titleAr, `%${query}%`),
        like(announcements.titleFr, `%${query}%`),
        like(announcements.contentEn, `%${query}%`),
        like(announcements.contentAr, `%${query}%`),
        like(announcements.contentFr, `%${query}%`),
      ),
    ),
  ).orderBy(announcements.createdAt).limit(10)
}

export async function getRecentAnnouncements(limit = 5) {
  return db.select().from(announcements).where(
    eq(announcements.isPublished, true),
  ).orderBy(announcements.createdAt).limit(limit)
}
