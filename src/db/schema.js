import {
  pgTable, bigint, text, boolean, uuid, timestamp, time, date,
  jsonb, integer, primaryKey,
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
  studentId: text('student_id'),
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

export const members = pgTable('members', {
  id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  applicationId: bigint('application_id', { mode: 'number' }).references(() => membershipApplications.id, { onDelete: 'set null' }),
  memberCode: text('member_code').unique(),
  fullName: text('full_name').notNull(),
  email: text().notNull(),
  phone: text(),
  studentId: text('student_id'),
  department: text(),
  studyYear: text('study_year'),
  skills: text().array(),
  interests: text().array(),
  photoUrl: text('photo_url'),
  // HR record: team/cell and lifecycle (active → alumni, etc.). Office roles
  // (president, treasurer, team lead…) live in member_positions with terms.
  team: text(),
  status: text().default('active'),
  joinedAt: date('joined_at').defaultNow(),
  leftAt: date('left_at'),
  birthDate: date('birth_date'),
  gender: text(),
  notes: text(),
  // member_code is assigned by the `members_assign_code` trigger on insert
  // (see migration 0010), so every member has a printable card from day one.
  cardQrCode: text('card_qr_code'),
  cardIssuedAt: timestamp('card_issued_at', { withTimezone: true }),
  cardStatus: text('card_status').default('active'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
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

export const faq = pgTable('faq', {
  id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  questionEn: text('question_en'),
  questionAr: text('question_ar'),
  questionFr: text('question_fr'),
  answerEn: text('answer_en'),
  answerAr: text('answer_ar'),
  answerFr: text('answer_fr'),
  category: text(),
  isPublished: boolean('is_published').default(true),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const pageContent = pgTable('page_content', {
  id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  section: text().notNull().unique(),
  imageUrl: text('image_url'),
  altText: text('alt_text'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const inventoryItems = pgTable('inventory_items', {
  id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  assetCode: text('asset_code').unique(),
  name: text().notNull(),
  category: text(),
  serial: text(),
  condition: text().default('good'),
  purchaseDate: date('purchase_date'),
  value: integer(),
  location: text(),
  photoUrl: text('photo_url'),
  status: text().default('available'),
  qrCode: text('qr_code'),
  notes: text(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const borrowRecords = pgTable('borrow_records', {
  id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  itemId: bigint('item_id', { mode: 'number' }).notNull().references(() => inventoryItems.id, { onDelete: 'cascade' }),
  memberId: bigint('member_id', { mode: 'number' }).references(() => members.id, { onDelete: 'set null' }),
  borrowerName: text('borrower_name'),
  checkedOutAt: timestamp('checked_out_at', { withTimezone: true }).defaultNow(),
  expectedReturnAt: timestamp('expected_return_at', { withTimezone: true }),
  returnedAt: timestamp('returned_at', { withTimezone: true }),
  conditionNoteOut: text('condition_note_out'),
  conditionNoteIn: text('condition_note_in'),
  status: text().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const aiKnowledge = pgTable('ai_knowledge', {
  id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  title: text().notNull(),
  slug: text().notNull().unique(),
  category: text(),
  content: text().notNull(),
  keywords: text().array(),
  published: boolean().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})


// Office held by a member for a term — president, treasurer, team lead, etc.
// A position is current while term_end is null or still in the future, and
// keeping past terms gives the club its board history for free.
export const memberPositions = pgTable('member_positions', {
  id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  memberId: bigint('member_id', { mode: 'number' }).notNull().references(() => members.id, { onDelete: 'cascade' }),
  title: text().notNull(),
  team: text(),
  termStart: date('term_start').notNull().defaultNow(),
  termEnd: date('term_end'),
  notes: text(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// Responsibilities handed to members, optionally tied to a project.
export const memberTasks = pgTable('member_tasks', {
  id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  title: text().notNull(),
  description: text(),
  assigneeId: bigint('assignee_id', { mode: 'number' }).references(() => members.id, { onDelete: 'set null' }),
  projectId: bigint('project_id', { mode: 'number' }).references(() => projects.id, { onDelete: 'set null' }),
  status: text().default('todo'),
  priority: text().default('normal'),
  dueDate: date('due_date'),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// Custom roles the club defines on top of the built-in offices in
// src/admin/lib/hr.js. member_positions.title stores the role name as-is, so
// deleting a role here only removes it from the pickers; past terms keep it.
export const memberRoles = pgTable('member_roles', {
  id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  name: text().notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// Ad-hoc groups of members (a workshop cohort, a trip, a committee). Unlike
// members.team, a member can belong to any number of groups.
export const memberGroups = pgTable('member_groups', {
  id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  name: text().notNull().unique(),
  description: text(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const memberGroupMembers = pgTable('member_group_members', {
  groupId: bigint('group_id', { mode: 'number' }).notNull().references(() => memberGroups.id, { onDelete: 'cascade' }),
  memberId: bigint('member_id', { mode: 'number' }).notNull().references(() => members.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, t => [primaryKey({ columns: [t.groupId, t.memberId] })])
