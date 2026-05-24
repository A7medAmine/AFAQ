import { db } from '../db/client.js'
import { aiKnowledge } from '../../src/db/schema.js'
import { like, or, eq, asc, desc, and, sql } from 'drizzle-orm'

export async function searchKnowledge(query) {
  return db.select().from(aiKnowledge).where(
    and(
      eq(aiKnowledge.published, true),
      or(
        like(aiKnowledge.title, `%${query}%`),
        like(aiKnowledge.content, `%${query}%`),
        like(aiKnowledge.category, `%${query}%`),
        sql`${query} = ANY(${aiKnowledge.keywords})`,
        like(aiKnowledge.slug, `%${query}%`),
      ),
    ),
  ).orderBy(asc(aiKnowledge.id)).limit(20)
}

export async function getAllKnowledge() {
  return db.select().from(aiKnowledge).orderBy(desc(aiKnowledge.updatedAt))
}

export async function getPublishedKnowledge() {
  return db.select().from(aiKnowledge).where(eq(aiKnowledge.published, true)).orderBy(asc(aiKnowledge.id))
}

export async function getKnowledgeByCategory(category) {
  return db.select().from(aiKnowledge).where(
    and(eq(aiKnowledge.published, true), eq(aiKnowledge.category, category)),
  ).orderBy(asc(aiKnowledge.id))
}

export async function createKnowledge(data) {
  const [result] = await db.insert(aiKnowledge).values(data).returning()
  return result
}

export async function updateKnowledge(id, data) {
  const [result] = await db.update(aiKnowledge).set(data).where(eq(aiKnowledge.id, id)).returning()
  return result
}

export async function deleteKnowledge(id) {
  await db.delete(aiKnowledge).where(eq(aiKnowledge.id, id))
}
