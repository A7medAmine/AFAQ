import {
  pgTable, bigint, text, boolean, uuid, timestamp, time, date,
  jsonb, integer, numeric, primaryKey, index, unique,
} from 'drizzle-orm/pg-core'

export const adminRoles = pgTable('admin_roles', {
  id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  name: text().notNull().unique(),
  label: text().notNull(),
  description: text(),
  // What the role may open in the console. Null keeps the built-in set from
  // src/admin/lib/permissions.js; roles created in the console always list theirs.
  permissions: text().array(),
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
  // Application review load balancing: an away reviewer gets no new
  // applications, and a capacity (when set) caps how many they hold open.
  reviewAvailable: boolean('review_available').notNull().default(true),
  reviewCapacity: integer('review_capacity'),
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
  // Review routing (see server/services/reviewRouting.js). `team_id` null
  // after routing means the general pool; `stage` tracks a pending
  // application's progress: pool → assigned → interview.
  teamId: bigint('team_id', { mode: 'number' }).references(() => reviewTeams.id, { onDelete: 'set null' }),
  reviewerId: bigint('reviewer_id', { mode: 'number' }).references(() => adminUsers.id, { onDelete: 'set null' }),
  stage: text().notNull().default('pool'),
  routedAt: timestamp('routed_at', { withTimezone: true }),
  assignedAt: timestamp('assigned_at', { withTimezone: true }),
  interviewAt: timestamp('interview_at', { withTimezone: true }),
  reviewRating: integer('review_rating'),
  reviewNotes: text('review_notes'),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  decidedBy: uuid('decided_by'),
  lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, t => [
  index('membership_applications_reviewer_idx').on(t.reviewerId, t.status),
  index('membership_applications_team_idx').on(t.teamId, t.status),
])

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
  // Left out of bulk notification emails (announcements, events).
  emailOptOut: boolean('email_opt_out').notNull().default(false),
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
  // How many of this item the club has, and how many are out on loan.
  quantity: integer().notNull().default(1),
  onLoan: integer('on_loan').notNull().default(0),
  // 'returnable' items are lent and come back; 'consumable' ones are handed
  // out and leave the stock. It only picks the default in Borrowing.
  trackingMode: text('tracking_mode').notNull().default('returnable'),
  // Flag the item as low once this many or fewer are on the shelf.
  minStock: integer('min_stock'),
  status: text().default('available'),
  qrCode: text('qr_code'),
  notes: text(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// A place items are kept. inventory_items.location holds the shelf's name as
// text, so imports and items stored somewhere ad hoc keep working.
export const shelves = pgTable('shelves', {
  id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  code: text().unique(),
  name: text().notNull().unique(),
  description: text(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// The public /links page (the QR on posters points there). `platform` picks
// the icon; anything unknown falls back to a plain link icon.
export const socialLinks = pgTable('social_links', {
  id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  label: text().notNull(),
  url: text().notNull(),
  platform: text().notNull().default('website'),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const borrowRecords = pgTable('borrow_records', {
  id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  itemId: bigint('item_id', { mode: 'number' }).notNull().references(() => inventoryItems.id, { onDelete: 'cascade' }),
  memberId: bigint('member_id', { mode: 'number' }).references(() => members.id, { onDelete: 'set null' }),
  borrowerName: text('borrower_name'),
  // 'loan' comes back; 'issue' is handed out for good (used in a build).
  kind: text().notNull().default('loan'),
  purpose: text(),
  quantity: integer().notNull().default(1),
  // Units of this record that never came back: all of an issue, or the part
  // of a loan that was used up.
  consumedQuantity: integer('consumed_quantity').notNull().default(0),
  // Records checked out together at the counter share one batch id.
  batchId: uuid('batch_id'),
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
// A row with builtin_key set renames that built-in office instead (terms keep
// storing the key, e.g. 'president'); deleting it restores the default name.
export const memberRoles = pgTable('member_roles', {
  id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  name: text().notNull().unique(),
  builtinKey: text('builtin_key').unique(),
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

// Club money in and out, in dinars. `kind` is income or expense; `category`
// is one of the values in src/admin/lib/finance.js. A row can be tied to the
// event or project it was spent on or raised for, which is what budgets
// measure their actuals against.
export const financeTransactions = pgTable('finance_transactions', {
  id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  kind: text().notNull(),
  category: text().notNull(),
  amount: numeric({ precision: 12, scale: 2 }).notNull(),
  occurredOn: date('occurred_on').notNull().defaultNow(),
  description: text(),
  counterparty: text(),
  paymentMethod: text('payment_method'),
  reference: text(),
  receiptUrl: text('receipt_url'),
  eventId: bigint('event_id', { mode: 'number' }).references(() => events.id, { onDelete: 'set null' }),
  projectId: bigint('project_id', { mode: 'number' }).references(() => projects.id, { onDelete: 'set null' }),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// What an event or project is expected to cost and bring in. Actuals are not
// stored: they are the sum of finance_transactions sharing its event/project.
export const financeBudgets = pgTable('finance_budgets', {
  id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  name: text().notNull(),
  eventId: bigint('event_id', { mode: 'number' }).references(() => events.id, { onDelete: 'cascade' }),
  projectId: bigint('project_id', { mode: 'number' }).references(() => projects.id, { onDelete: 'cascade' }),
  plannedIncome: numeric('planned_income', { precision: 12, scale: 2 }).notNull().default('0'),
  plannedExpense: numeric('planned_expense', { precision: 12, scale: 2 }).notNull().default('0'),
  notes: text(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// Reusable layouts for notification emails. `kind` says which composer offers
// the template (announcement, event or general). The structured fields are
// rendered by src/lib/emailTemplate.js; when `custom_html` is set it replaces
// the built-in layout entirely. Both accept {{variables}}.
export const emailTemplates = pgTable('email_templates', {
  id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  name: text().notNull(),
  kind: text().notNull().default('general'),
  subject: text().notNull(),
  headerText: text('header_text'),
  heading: text(),
  body: text(),
  buttonLabel: text('button_label'),
  buttonUrl: text('button_url'),
  footer: text(),
  accentColor: text('accent_color').notNull().default('#0F172A'),
  customHtml: text('custom_html'),
  isDefault: boolean('is_default').notNull().default(false),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// One bulk send. The template and the shared variables (title, date, link…)
// are snapshotted at creation, so editing the template or the announcement
// mid-send cannot change what later recipients get. Sending is driven in
// batches by the console (serverless functions cannot keep working after
// they respond), so an interrupted send is resumed, not lost.
export const emailCampaigns = pgTable('email_campaigns', {
  id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  subject: text().notNull(),
  templateId: bigint('template_id', { mode: 'number' }).references(() => emailTemplates.id, { onDelete: 'set null' }),
  template: jsonb().notNull(),
  variables: jsonb().notNull(),
  sourceType: text('source_type'),
  sourceId: bigint('source_id', { mode: 'number' }),
  language: text().notNull().default('en'),
  audience: jsonb().notNull(),
  total: integer().notNull().default(0),
  sent: integer().notNull().default(0),
  failed: integer().notNull().default(0),
  status: text().notNull().default('queued'),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
})

export const emailDeliveries = pgTable('email_deliveries', {
  id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  campaignId: bigint('campaign_id', { mode: 'number' }).notNull().references(() => emailCampaigns.id, { onDelete: 'cascade' }),
  memberId: bigint('member_id', { mode: 'number' }).references(() => members.id, { onDelete: 'set null' }),
  email: text().notNull(),
  name: text(),
  status: text().notNull().default('queued'),
  error: text(),
  sentAt: timestamp('sent_at', { withTimezone: true }),
}, t => [
  unique('email_deliveries_campaign_email_key').on(t.campaignId, t.email),
  index('email_deliveries_campaign_status_idx').on(t.campaignId, t.status),
])

// Review teams spread membership interviews across admins: an application is
// routed to the team its interests point to, then to that team's least-loaded
// reviewer, so a tech applicant is interviewed by someone from tech.
export const reviewTeams = pgTable('review_teams', {
  id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  nameEn: text('name_en').notNull(),
  nameAr: text('name_ar'),
  nameFr: text('name_fr'),
  description: text(),
  color: text().notNull().default('#2563EB'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// Interests offered on the join form. `key` is what applications and members
// store in their interests arrays, so renaming a label never orphans data.
export const interests = pgTable('interests', {
  id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  key: text().notNull().unique(),
  labelEn: text('label_en').notNull(),
  labelAr: text('label_ar'),
  labelFr: text('label_fr'),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const interestTeams = pgTable('interest_teams', {
  interestId: bigint('interest_id', { mode: 'number' }).notNull().references(() => interests.id, { onDelete: 'cascade' }),
  teamId: bigint('team_id', { mode: 'number' }).notNull().references(() => reviewTeams.id, { onDelete: 'cascade' }),
}, t => [primaryKey({ columns: [t.interestId, t.teamId] })])

export const teamReviewers = pgTable('team_reviewers', {
  teamId: bigint('team_id', { mode: 'number' }).notNull().references(() => reviewTeams.id, { onDelete: 'cascade' }),
  adminUserId: bigint('admin_user_id', { mode: 'number' }).notNull().references(() => adminUsers.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, t => [primaryKey({ columns: [t.teamId, t.adminUserId] })])

// History of an application's trip through review: routed, claimed,
// transferred, reassigned for going stale, interview set, decided.
export const applicationEvents = pgTable('application_events', {
  id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  applicationId: bigint('application_id', { mode: 'number' }).notNull().references(() => membershipApplications.id, { onDelete: 'cascade' }),
  kind: text().notNull(),
  fromTeamId: bigint('from_team_id', { mode: 'number' }),
  toTeamId: bigint('to_team_id', { mode: 'number' }),
  fromReviewerId: bigint('from_reviewer_id', { mode: 'number' }),
  toReviewerId: bigint('to_reviewer_id', { mode: 'number' }),
  note: text(),
  actorId: uuid('actor_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, t => [index('application_events_application_idx').on(t.applicationId)])

// Single-row settings for review routing.
export const reviewSettings = pgTable('review_settings', {
  id: integer().primaryKey().default(1),
  staleDays: integer('stale_days').notNull().default(5),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// Club departments (Tech, Media, Logistics…) that needs are grouped under.
// Edited in the console; not the same thing as members.department, which is
// the member's field of study.
export const departments = pgTable('departments', {
  id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  name: text().notNull().unique(),
  color: text(),
  description: text(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// A list of things logistics has to get together. `scope` says what it is
// for: an event, one department's standing needs, or anything else.
export const needLists = pgTable('need_lists', {
  id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  title: text().notNull(),
  scope: text().notNull().default('custom'),
  eventId: bigint('event_id', { mode: 'number' }).references(() => events.id, { onDelete: 'set null' }),
  departmentId: bigint('department_id', { mode: 'number' }).references(() => departments.id, { onDelete: 'set null' }),
  dueDate: date('due_date'),
  status: text().notNull().default('open'),
  notes: text(),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// One line of a needs list. `source` is where it will come from (club stock,
// buying it, borrowing it); `status` tracks it from needed to in hand.
export const needItems = pgTable('need_items', {
  id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  listId: bigint('list_id', { mode: 'number' }).notNull().references(() => needLists.id, { onDelete: 'cascade' }),
  departmentId: bigint('department_id', { mode: 'number' }).references(() => departments.id, { onDelete: 'set null' }),
  kind: text().notNull().default('equipment'),
  name: text().notNull(),
  quantity: integer().notNull().default(1),
  unit: text(),
  inventoryItemId: bigint('inventory_item_id', { mode: 'number' }).references(() => inventoryItems.id, { onDelete: 'set null' }),
  source: text().notNull().default('buy'),
  status: text().notNull().default('needed'),
  priority: text().notNull().default('must'),
  assignee: text(),
  notes: text(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, t => [index('need_items_list_id_idx').on(t.listId)])
