CREATE TABLE "email_campaigns" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "email_campaigns_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"subject" text NOT NULL,
	"template_id" bigint,
	"template" jsonb NOT NULL,
	"variables" jsonb NOT NULL,
	"source_type" text,
	"source_id" bigint,
	"language" text DEFAULT 'en' NOT NULL,
	"audience" jsonb NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"sent" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "email_deliveries" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "email_deliveries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"campaign_id" bigint NOT NULL,
	"member_id" bigint,
	"email" text NOT NULL,
	"name" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"error" text,
	"sent_at" timestamp with time zone,
	CONSTRAINT "email_deliveries_campaign_email_key" UNIQUE("campaign_id","email")
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "email_templates_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"kind" text DEFAULT 'general' NOT NULL,
	"subject" text NOT NULL,
	"header_text" text,
	"heading" text,
	"body" text,
	"button_label" text,
	"button_url" text,
	"footer" text,
	"accent_color" text DEFAULT '#0F172A' NOT NULL,
	"custom_html" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "email_opt_out" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "email_campaigns" ADD CONSTRAINT "email_campaigns_template_id_email_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."email_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_campaign_id_email_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."email_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_deliveries_campaign_status_idx" ON "email_deliveries" USING btree ("campaign_id","status");--> statement-breakpoint
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_kind_check" CHECK ("kind" IN ('announcement', 'event', 'general'));--> statement-breakpoint
ALTER TABLE "email_campaigns" ADD CONSTRAINT "email_campaigns_status_check" CHECK ("status" IN ('queued', 'sending', 'sent', 'partial', 'failed'));--> statement-breakpoint
ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_status_check" CHECK ("status" IN ('queued', 'sending', 'sent', 'failed'));--> statement-breakpoint
-- RLS: anyone who publishes (announcements.manage in the console) can manage
-- templates and read send history. Campaigns and deliveries are only written
-- by the server with the service role.
ALTER TABLE "email_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "email_campaigns" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "email_deliveries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "admin_all_email_templates" ON "email_templates";--> statement-breakpoint
CREATE POLICY "admin_all_email_templates" ON "email_templates"
	FOR ALL USING (has_role('event_manager') OR has_role('media_manager') OR has_role('project_manager'));--> statement-breakpoint
DROP POLICY IF EXISTS "admin_read_email_campaigns" ON "email_campaigns";--> statement-breakpoint
CREATE POLICY "admin_read_email_campaigns" ON "email_campaigns"
	FOR SELECT USING (has_role('event_manager') OR has_role('media_manager') OR has_role('project_manager'));--> statement-breakpoint
DROP POLICY IF EXISTS "admin_read_email_deliveries" ON "email_deliveries";--> statement-breakpoint
CREATE POLICY "admin_read_email_deliveries" ON "email_deliveries"
	FOR SELECT USING (has_role('event_manager') OR has_role('media_manager') OR has_role('project_manager'));--> statement-breakpoint
INSERT INTO "email_templates" ("name", "kind", "subject", "header_text", "heading", "body", "button_label", "button_url", "footer", "accent_color", "is_default") VALUES
	('Announcement', 'announcement', '{{title}}', '{{club_name}}', '{{title}}',
	 E'Hello {{first_name}},\n\n{{content}}',
	 'Read on the site', '{{link}}',
	 E'You receive this email because you are a member of {{club_name}}.', '#0F172A', true),
	('Event invitation', 'event', 'You''re invited: {{title}}', '{{club_name}}', '{{title}}',
	 E'Hello {{first_name}},\n\n{{content}}\n\n**Date:** {{event_date}} {{event_time}}\n**Place:** {{event_location}}',
	 'See the event', '{{link}}',
	 E'You receive this email because you are a member of {{club_name}}.', '#2563EB', true),
	('General message', 'general', '{{title}}', '{{club_name}}', '{{title}}',
	 E'Hello {{first_name}},\n\n{{content}}',
	 NULL, NULL,
	 E'You receive this email because you are a member of {{club_name}}.', '#0F172A', true);
