CREATE TABLE "application_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "application_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"application_id" bigint NOT NULL,
	"kind" text NOT NULL,
	"from_team_id" bigint,
	"to_team_id" bigint,
	"from_reviewer_id" bigint,
	"to_reviewer_id" bigint,
	"note" text,
	"actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "interest_teams" (
	"interest_id" bigint NOT NULL,
	"team_id" bigint NOT NULL,
	CONSTRAINT "interest_teams_interest_id_team_id_pk" PRIMARY KEY("interest_id","team_id")
);
--> statement-breakpoint
CREATE TABLE "interests" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "interests_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"key" text NOT NULL,
	"label_en" text NOT NULL,
	"label_ar" text,
	"label_fr" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "interests_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "review_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"stale_days" integer DEFAULT 5 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "review_teams" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "review_teams_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name_en" text NOT NULL,
	"name_ar" text,
	"name_fr" text,
	"description" text,
	"color" text DEFAULT '#2563EB' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "team_reviewers" (
	"team_id" bigint NOT NULL,
	"admin_user_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "team_reviewers_team_id_admin_user_id_pk" PRIMARY KEY("team_id","admin_user_id")
);
--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "review_available" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "review_capacity" integer;--> statement-breakpoint
ALTER TABLE "membership_applications" ADD COLUMN "team_id" bigint;--> statement-breakpoint
ALTER TABLE "membership_applications" ADD COLUMN "reviewer_id" bigint;--> statement-breakpoint
ALTER TABLE "membership_applications" ADD COLUMN "stage" text DEFAULT 'pool' NOT NULL;--> statement-breakpoint
ALTER TABLE "membership_applications" ADD COLUMN "routed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "membership_applications" ADD COLUMN "assigned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "membership_applications" ADD COLUMN "interview_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "membership_applications" ADD COLUMN "review_rating" integer;--> statement-breakpoint
ALTER TABLE "membership_applications" ADD COLUMN "review_notes" text;--> statement-breakpoint
ALTER TABLE "membership_applications" ADD COLUMN "decided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "membership_applications" ADD COLUMN "decided_by" uuid;--> statement-breakpoint
ALTER TABLE "membership_applications" ADD COLUMN "last_activity_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "application_events" ADD CONSTRAINT "application_events_application_id_membership_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."membership_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interest_teams" ADD CONSTRAINT "interest_teams_interest_id_interests_id_fk" FOREIGN KEY ("interest_id") REFERENCES "public"."interests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interest_teams" ADD CONSTRAINT "interest_teams_team_id_review_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."review_teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_reviewers" ADD CONSTRAINT "team_reviewers_team_id_review_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."review_teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_reviewers" ADD CONSTRAINT "team_reviewers_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "application_events_application_idx" ON "application_events" USING btree ("application_id");--> statement-breakpoint
ALTER TABLE "membership_applications" ADD CONSTRAINT "membership_applications_team_id_review_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."review_teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_applications" ADD CONSTRAINT "membership_applications_reviewer_id_admin_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "membership_applications_reviewer_idx" ON "membership_applications" USING btree ("reviewer_id","status");--> statement-breakpoint
CREATE INDEX "membership_applications_team_idx" ON "membership_applications" USING btree ("team_id","status");--> statement-breakpoint
ALTER TABLE "membership_applications" ADD CONSTRAINT "membership_applications_stage_check" CHECK ("stage" IN ('pool', 'assigned', 'interview'));--> statement-breakpoint
ALTER TABLE "membership_applications" ADD CONSTRAINT "membership_applications_rating_check" CHECK ("review_rating" IS NULL OR "review_rating" BETWEEN 1 AND 5);--> statement-breakpoint
ALTER TABLE "review_settings" ADD CONSTRAINT "review_settings_singleton" CHECK ("id" = 1);--> statement-breakpoint
ALTER TABLE "review_settings" ADD CONSTRAINT "review_settings_stale_days_check" CHECK ("stale_days" BETWEEN 1 AND 60);--> statement-breakpoint
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_review_capacity_check" CHECK ("review_capacity" IS NULL OR "review_capacity" >= 0);--> statement-breakpoint
-- Applications decided before routing existed never enter the review queues.
UPDATE "membership_applications" SET "routed_at" = "created_at" WHERE "status" <> 'pending';--> statement-breakpoint
-- RLS: the join form reads active interests; admins who manage membership
-- edit teams, interests and settings. Reviewers act through the server
-- (service role), which checks team membership itself.
ALTER TABLE "review_teams" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "interests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "interest_teams" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "team_reviewers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "application_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "review_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "public_select_interests" ON "interests";--> statement-breakpoint
CREATE POLICY "public_select_interests" ON "interests"
	FOR SELECT USING ("is_active" = true);--> statement-breakpoint
DROP POLICY IF EXISTS "admin_all_interests" ON "interests";--> statement-breakpoint
CREATE POLICY "admin_all_interests" ON "interests"
	FOR ALL USING (has_role('event_manager'));--> statement-breakpoint
DROP POLICY IF EXISTS "admin_all_review_teams" ON "review_teams";--> statement-breakpoint
CREATE POLICY "admin_all_review_teams" ON "review_teams"
	FOR ALL USING (has_role('event_manager'));--> statement-breakpoint
DROP POLICY IF EXISTS "admin_all_interest_teams" ON "interest_teams";--> statement-breakpoint
CREATE POLICY "admin_all_interest_teams" ON "interest_teams"
	FOR ALL USING (has_role('event_manager'));--> statement-breakpoint
DROP POLICY IF EXISTS "admin_all_team_reviewers" ON "team_reviewers";--> statement-breakpoint
CREATE POLICY "admin_all_team_reviewers" ON "team_reviewers"
	FOR ALL USING (has_role('event_manager'));--> statement-breakpoint
DROP POLICY IF EXISTS "admin_read_application_events" ON "application_events";--> statement-breakpoint
CREATE POLICY "admin_read_application_events" ON "application_events"
	FOR SELECT USING (has_role('event_manager'));--> statement-breakpoint
DROP POLICY IF EXISTS "admin_all_review_settings" ON "review_settings";--> statement-breakpoint
CREATE POLICY "admin_all_review_settings" ON "review_settings"
	FOR ALL USING (has_role('event_manager'));--> statement-breakpoint
INSERT INTO "review_settings" ("id", "stale_days") VALUES (1, 5) ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
-- Starter teams and interests. The six technical interests are the keys the
-- join form already stored; the rest give Media and Languages something to route.
INSERT INTO "review_teams" ("name_en", "name_ar", "name_fr", "color", "sort_order") VALUES
	('Tech', 'التقنية', 'Technique', '#2563EB', 1),
	('Media', 'الإعلام', 'Média', '#DB2777', 2),
	('Languages', 'اللغات', 'Langues', '#059669', 3);--> statement-breakpoint
INSERT INTO "interests" ("key", "label_en", "label_ar", "label_fr", "sort_order") VALUES
	('robotics', 'Robotics', 'الروبوتات', 'Robotique', 1),
	('programming', 'Programming', 'البرمجة', 'Programmation', 2),
	('electronics', 'Electronics', 'الإلكترونيات', 'Électronique', 3),
	('iot', 'IoT', 'إنترنت الأشياء', 'IoT', 4),
	('ai', 'Artificial Intelligence', 'الذكاء الاصطناعي', 'Intelligence Artificielle', 5),
	('web', 'Web Development', 'تطوير الويب', 'Développement Web', 6),
	('design', 'Graphic Design', 'التصميم الجرافيكي', 'Design Graphique', 7),
	('photo_video', 'Photography & Video', 'التصوير والفيديو', 'Photo & Vidéo', 8),
	('content', 'Content & Social Media', 'المحتوى ووسائل التواصل', 'Contenu & Réseaux Sociaux', 9),
	('languages', 'Languages & Translation', 'اللغات والترجمة', 'Langues & Traduction', 10)
ON CONFLICT ("key") DO NOTHING;--> statement-breakpoint
INSERT INTO "interest_teams" ("interest_id", "team_id")
SELECT i."id", t."id" FROM "interests" i JOIN "review_teams" t ON
	(t."name_en" = 'Tech' AND i."key" IN ('robotics', 'programming', 'electronics', 'iot', 'ai', 'web'))
	OR (t."name_en" = 'Media' AND i."key" IN ('design', 'photo_video', 'content'))
	OR (t."name_en" = 'Languages' AND i."key" IN ('languages'))
ON CONFLICT DO NOTHING;
