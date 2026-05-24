import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  out: './supabase/migrations',
  schema: './src/db/schema.js',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  filters: {
    schemas: ['public'],
  },
})
