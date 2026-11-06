CREATE TABLE "tutorials" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tutorials_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"content" text,
	"cover_url" text,
	"level" text DEFAULT 'beginner' NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"resources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"requirements" text,
	"event_id" bigint,
	"is_published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "tutorials_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "tutorials" ADD CONSTRAINT "tutorials_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tutorials_event_idx" ON "tutorials" USING btree ("event_id");--> statement-breakpoint
ALTER TABLE "tutorials" ADD CONSTRAINT "tutorials_level_check" CHECK ("level" IN ('beginner', 'intermediate', 'advanced'));--> statement-breakpoint
ALTER TABLE "tutorials" ADD CONSTRAINT "tutorials_slug_format" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');--> statement-breakpoint
-- Stamp the first publish and every edit, so the client never has to.
CREATE OR REPLACE FUNCTION public.tutorials_touch()
RETURNS TRIGGER AS $$
BEGIN
	NEW.updated_at := now();
	IF NEW.is_published AND NEW.published_at IS NULL THEN
		NEW.published_at := now();
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;--> statement-breakpoint
DROP TRIGGER IF EXISTS "tutorials_touch" ON "tutorials";--> statement-breakpoint
CREATE TRIGGER "tutorials_touch" BEFORE INSERT OR UPDATE ON "tutorials"
	FOR EACH ROW EXECUTE FUNCTION public.tutorials_touch();--> statement-breakpoint
ALTER TABLE "tutorials" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- Event and project managers run workshops; custom roles get in through the
-- tutorials.manage permission. has_role() already lets owner and super admin in.
DROP POLICY IF EXISTS "admin_all_tutorials" ON "tutorials";--> statement-breakpoint
CREATE POLICY "admin_all_tutorials" ON "tutorials" FOR ALL
	USING (has_role('event_manager') OR has_role('project_manager') OR has_permission('tutorials.manage'))
	WITH CHECK (has_role('event_manager') OR has_role('project_manager') OR has_permission('tutorials.manage'));--> statement-breakpoint
DROP POLICY IF EXISTS "public_select_published_tutorials" ON "tutorials";--> statement-breakpoint
CREATE POLICY "public_select_published_tutorials" ON "tutorials" FOR SELECT USING (is_published = true);
