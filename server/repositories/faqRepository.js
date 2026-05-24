import { db } from '../db/client.js'
import { faq } from '../../src/db/schema.js'
import { like, or, and, eq } from 'drizzle-orm'

export async function searchFaqs(query) {
  const results = await db.select().from(faq).where(
    and(
      eq(faq.isPublished, true),
      or(
        like(faq.questionEn, `%${query}%`),
        like(faq.questionAr, `%${query}%`),
        like(faq.questionFr, `%${query}%`),
        like(faq.answerEn, `%${query}%`),
        like(faq.answerAr, `%${query}%`),
        like(faq.answerFr, `%${query}%`),
      ),
    ),
  ).orderBy(faq.sortOrder).limit(10)
  return results
}

export async function getAllFaqs() {
  return db.select().from(faq).where(eq(faq.isPublished, true)).orderBy(faq.sortOrder).limit(10)
}
