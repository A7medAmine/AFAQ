import {
  pgTable, bigint, text, boolean, uuid, timestamp, time, date,
  jsonb, integer,
} from 'drizzle-orm/pg-core'

export const adminRoles = pgTable('admin_roles', {
  id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  name: text().notNull().unique(),
  label: text().notNull(),
  description: text(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const adminUsers = pgTable('admin_users', {
  id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  userId: uuid('user_id').notNull().unique(),
  roleId: bigint('role_id', { mode: 'number' }).notNull().references(() => adminRoles.id),
  email: text().notNull(),
  fullName: text('full_name'),
  avatarUrl: text('avatar_url'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const events = pgTable('events', {
  id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  titleEn: text('title_en').notNull(),
  titleAr: text('title_ar'),
  titleFr: text('title_fr'),
  descriptionEn: text('description_en'),
  descriptionAr: text('description_ar'),
  descriptionFr: text('description_fr'),
  date: date().notNull(),
  time: time(),
  locationEn: text('location_en'),
  locationAr: text('location_ar'),
  locationFr: text('location_fr'),
  posterUrl: text('poster_url'),
  maxParticipants: integer('max_participants').default(0),
  registrationOpen: boolean('registration_open').default(false),
  isPublished: boolean('is_published').default(false),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const eventRegistrations = pgTable('event_registrations', {
  id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  eventId: bigint('event_id', { mode: 'number' }).notNull().references(() => events.id, { onDelete: 'cascade' }),
  fullName: text('full_name').notNull(),
  email: text().notNull(),
  phone: text(),
  department: text(),
  studyYear: text('study_year'),
  skills: text().array(),
  interests: text().array(),
  motivation: text(),
  status: text().default('pending'),
  agreedToPolicies: boolean('agreed_to_policies').default(false),
  qrCode: text('qr_code'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const membershipApplications = pgTable('membership_applications', {
  id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  studentId: text('student_id'),
  fullName: text('full_name').notNull(),
  email: text().notNull(),
  phone: text(),
  department: text(),
  studyYear: text('study_year'),
  skills: text().array(),
  interests: text().array(),
  motivation: text(),
  status: text().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const projects = pgTable('projects', {
  id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  titleEn: text('title_en').notNull(),
  titleAr: text('title_ar'),
  titleFr: text('title_fr'),
  descriptionEn: text('description_en'),
  descriptionAr: text('description_ar'),
  descriptionFr: text('description_fr'),
  category: text(),
  technologies: text().array(),
  githubUrl: text('github_url'),
  demoUrl: text('demo_url'),
  thumbnailUrl: text('thumbnail_url'),
  isPublished: boolean('is_published').default(false),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const projectImages = pgTable('project_images', {
  id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  projectId: bigint('project_id', { mode: 'number' }).notNull().references(() => projects.id, { onDelete: 'cascade' }),
  url: text().notNull(),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const galleryAlbums = pgTable('gallery_albums', {
  id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  titleEn: text('title_en').notNull(),
  titleAr: text('title_ar'),
  titleFr: text('title_fr'),
  description: text(),
  coverUrl: text('cover_url'),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const galleryImages = pgTable('gallery_images', {
  id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  albumId: bigint('album_id', { mode: 'number' }).notNull().references(() => galleryAlbums.id, { onDelete: 'cascade' }),
  url: text().notNull(),
  altText: text('alt_text'),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const announcements = pgTable('announcements', {
  id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  titleEn: text('title_en').notNull(),
  titleAr: text('title_ar'),
  titleFr: text('title_fr'),
  contentEn: text('content_en'),
  contentAr: text('content_ar'),
  contentFr: text('content_fr'),
  isPinned: boolean('is_pinned').default(false),
  isPublished: boolean('is_published').default(true),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const contactMessages = pgTable('contact_messages', {
  id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  name: text().notNull(),
  email: text().notNull(),
  subject: text().notNull(),
  message: text().notNull(),
  isRead: boolean('is_read').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const activityLogs = pgTable('activity_logs', {
  id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  userId: uuid('user_id'),
  action: text().notNull(),
  entityType: text('entity_type'),
  entityId: bigint('entity_id', { mode: 'number' }),
  metadata: jsonb(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})
