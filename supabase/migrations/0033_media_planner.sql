CREATE TABLE "media_assets" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "media_assets_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"post_id" bigint NOT NULL,
	"kind" text DEFAULT 'raw' NOT NULL,
	"url" text NOT NULL,
	"file_name" text,
	"uploaded_by" bigint,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "media_comments" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "media_comments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"post_id" bigint NOT NULL,
	"author_id" bigint,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "media_frames" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "media_frames_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"size" text DEFAULT 'post' NOT NULL,
	"url" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "media_posts" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "media_posts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"title" text NOT NULL,
	"brief" text,
	"format" text DEFAULT 'post' NOT NULL,
	"platforms" text[] DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'idea' NOT NULL,
	"event_id" bigint,
	"publish_at" timestamp with time zone,
	"caption_ar" text,
	"caption_fr" text,
	"caption_en" text,
	"hashtags" text,
	"shot_list" text,
	"needs_shoot" boolean DEFAULT true NOT NULL,
	"writer_id" bigint,
	"photographer_id" bigint,
	"editor_id" bigint,
	"publisher_id" bigint,
	"posted_links" text,
	"posted_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "media_snippets" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "media_snippets_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"kind" text DEFAULT 'hashtags' NOT NULL,
	"label" text NOT NULL,
	"body" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_post_id_media_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."media_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploaded_by_admin_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_comments" ADD CONSTRAINT "media_comments_post_id_media_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."media_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_comments" ADD CONSTRAINT "media_comments_author_id_admin_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_posts" ADD CONSTRAINT "media_posts_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_posts" ADD CONSTRAINT "media_posts_writer_id_admin_users_id_fk" FOREIGN KEY ("writer_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_posts" ADD CONSTRAINT "media_posts_photographer_id_admin_users_id_fk" FOREIGN KEY ("photographer_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_posts" ADD CONSTRAINT "media_posts_editor_id_admin_users_id_fk" FOREIGN KEY ("editor_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_posts" ADD CONSTRAINT "media_posts_publisher_id_admin_users_id_fk" FOREIGN KEY ("publisher_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_assets_post_idx" ON "media_assets" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "media_comments_post_idx" ON "media_comments" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "media_posts_status_idx" ON "media_posts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "media_posts_publish_at_idx" ON "media_posts" USING btree ("publish_at");--> statement-breakpoint
ALTER TABLE "media_posts" ADD CONSTRAINT "media_posts_status_check" CHECK ("status" IN ('idea', 'caption', 'shooting', 'editing', 'review', 'scheduled', 'posted', 'dropped'));--> statement-breakpoint
ALTER TABLE "media_posts" ADD CONSTRAINT "media_posts_format_check" CHECK ("format" IN ('post', 'carousel', 'story', 'reel', 'video', 'article'));--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_kind_check" CHECK ("kind" IN ('raw', 'final', 'reference'));--> statement-breakpoint
ALTER TABLE "media_frames" ADD CONSTRAINT "media_frames_size_check" CHECK ("size" IN ('post', 'square', 'story'));--> statement-breakpoint
ALTER TABLE "media_snippets" ADD CONSTRAINT "media_snippets_kind_check" CHECK ("kind" IN ('hashtags', 'template', 'cta'));--> statement-breakpoint
-- The media team: the built-in media manager role, plus any console role
-- given media.manage. Owner and super admins pass both checks.
CREATE OR REPLACE FUNCTION public.is_media_team()
RETURNS BOOLEAN AS $$
	SELECT has_role('media_manager') OR has_permission('media.manage');
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;--> statement-breakpoint
-- Names for the assignee pickers. admin_users itself stays closed to roles
-- without hr.manage, so this returns only what the planner shows.
CREATE OR REPLACE FUNCTION public.media_people()
RETURNS TABLE (id BIGINT, full_name TEXT, email TEXT, avatar_url TEXT, role_label TEXT) AS $$
	SELECT au.id, au.full_name, au.email, au.avatar_url, r.label
	FROM admin_users au JOIN admin_roles r ON r.id = au.role_id
	WHERE au.is_active = true AND is_media_team()
	ORDER BY coalesce(au.full_name, au.email);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;--> statement-breakpoint
ALTER TABLE "media_posts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "media_assets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "media_comments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "media_frames" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "media_snippets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "media_all_media_posts" ON "media_posts";--> statement-breakpoint
CREATE POLICY "media_all_media_posts" ON "media_posts" FOR ALL USING (is_media_team()) WITH CHECK (is_media_team());--> statement-breakpoint
DROP POLICY IF EXISTS "media_all_media_assets" ON "media_assets";--> statement-breakpoint
CREATE POLICY "media_all_media_assets" ON "media_assets" FOR ALL USING (is_media_team()) WITH CHECK (is_media_team());--> statement-breakpoint
DROP POLICY IF EXISTS "media_read_media_comments" ON "media_comments";--> statement-breakpoint
CREATE POLICY "media_read_media_comments" ON "media_comments" FOR SELECT USING (is_media_team());--> statement-breakpoint
-- A comment is written as yourself and only its author can delete it.
DROP POLICY IF EXISTS "media_insert_own_media_comments" ON "media_comments";--> statement-breakpoint
CREATE POLICY "media_insert_own_media_comments" ON "media_comments" FOR INSERT WITH CHECK (
	is_media_team() AND author_id = (SELECT id FROM admin_users WHERE user_id = auth.uid())
);--> statement-breakpoint
DROP POLICY IF EXISTS "media_delete_own_media_comments" ON "media_comments";--> statement-breakpoint
CREATE POLICY "media_delete_own_media_comments" ON "media_comments" FOR DELETE USING (
	is_media_team() AND author_id = (SELECT id FROM admin_users WHERE user_id = auth.uid())
);--> statement-breakpoint
DROP POLICY IF EXISTS "media_all_media_frames" ON "media_frames";--> statement-breakpoint
CREATE POLICY "media_all_media_frames" ON "media_frames" FOR ALL USING (is_media_team()) WITH CHECK (is_media_team());--> statement-breakpoint
DROP POLICY IF EXISTS "media_all_media_snippets" ON "media_snippets";--> statement-breakpoint
CREATE POLICY "media_all_media_snippets" ON "media_snippets" FOR ALL USING (is_media_team()) WITH CHECK (is_media_team());--> statement-breakpoint
INSERT INTO "media_snippets" ("kind", "label", "body", "sort_order") VALUES
	('hashtags', 'Club', '#AFAQ #AFAQClub #ScientificClub #نادي_آفاق', 1),
	('hashtags', 'Robotics', '#Robotics #Arduino #Electronics #Engineering #STEM', 2),
	('hashtags', 'Events', '#Workshop #Hackathon #StudentLife #TechEvent', 3),
	('cta', 'Register', 'Register now — link in bio.', 4),
	('cta', 'Follow', 'Follow us for more workshops and projects.', 5),
	('template', 'Event announcement', E'📢 {event}\n📅 {date}\n📍 {location}\n\n{what}\n\nRegister now — link in bio.', 6),
	('template', 'Event recap', E'Thank you to everyone who joined {event}! 🙌\n\n{highlights}\n\nSee you at the next one.', 7);
