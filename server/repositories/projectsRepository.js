import { db } from '../db/client.js'
import { projects } from '../../src/db/schema.js'
import { like, or, and, eq } from 'drizzle-orm'

export async function searchProjects(query) {
  return db.select().from(projects).where(
    and(
      eq(projects.isPublished, true),
      or(
        like(projects.titleEn, `%${query}%`),
        like(projects.titleAr, `%${query}%`),
        like(projects.titleFr, `%${query}%`),
        like(projects.descriptionEn, `%${query}%`),
        like(projects.descriptionAr, `%${query}%`),
        like(projects.descriptionFr, `%${query}%`),
      ),
    ),
  ).orderBy(projects.createdAt).limit(10)
}

export async function getAllPublishedProjects() {
  return db.select().from(projects).where(eq(projects.isPublished, true)).orderBy(projects.createdAt).limit(10)
}
