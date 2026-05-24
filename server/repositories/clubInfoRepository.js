import { db } from '../db/client.js'
import { clubInfo } from '../../src/db/schema.js'
import { like, or, eq, asc } from 'drizzle-orm'

export async function searchClubInfo(query) {
  return db.select().from(clubInfo).where(
    or(
      like(clubInfo.key, `%${query}%`),
      like(clubInfo.labelEn, `%${query}%`),
      like(clubInfo.labelAr, `%${query}%`),
      like(clubInfo.labelFr, `%${query}%`),
      like(clubInfo.valueEn, `%${query}%`),
      like(clubInfo.valueAr, `%${query}%`),
      like(clubInfo.valueFr, `%${query}%`),
    ),
  ).orderBy(asc(clubInfo.sortOrder)).limit(20)
}

export async function getAllClubInfo() {
  return db.select().from(clubInfo).orderBy(asc(clubInfo.sortOrder))
}

export async function createClubInfo(data) {
  const [result] = await db.insert(clubInfo).values(data).returning()
  return result
}

export async function updateClubInfo(id, data) {
  const [result] = await db.update(clubInfo).set(data).where(eq(clubInfo.id, id)).returning()
  return result
}

export async function deleteClubInfo(id) {
  await db.delete(clubInfo).where(eq(clubInfo.id, id))
}
