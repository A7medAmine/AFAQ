CREATE TABLE "member_positions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "member_positions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"member_id" bigint NOT NULL,
	"title" text NOT NULL,
	"team" text,
	"term_start" date DEFAULT now() NOT NULL,
	"term_end" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "member_tasks" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "member_tasks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"title" text NOT NULL,
	"description" text,
	"assignee_id" bigint,
	"project_id" bigint,
	"status" text DEFAULT 'todo',
	"priority" text DEFAULT 'normal',
	"due_date" date,
	"completed_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "members" ALTER COLUMN "card_status" SET DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "team" text;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "status" text DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "joined_at" date DEFAULT now();--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "left_at" date;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "birth_date" date;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "gender" text;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "member_positions" ADD CONSTRAINT "member_positions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_tasks" ADD CONSTRAINT "member_tasks_assignee_id_members_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_tasks" ADD CONSTRAINT "member_tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Every member gets their number (and so a printable card) the moment the row
-- exists, whether it came from an approved application or was added by hand.
-- An identity column is filled before BEFORE-INSERT triggers run, so NEW.id is set.
CREATE OR REPLACE FUNCTION public.assign_member_code() RETURNS trigger AS $$
BEGIN
	IF NEW.member_code IS NULL OR btrim(NEW.member_code) = '' THEN
		NEW.member_code := 'AFQ-' || lpad(NEW.id::text, 5, '0');
	END IF;
	IF NEW.card_issued_at IS NULL THEN
		NEW.card_issued_at := now();
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
DROP TRIGGER IF EXISTS "members_assign_code" ON "members";--> statement-breakpoint
CREATE TRIGGER "members_assign_code" BEFORE INSERT ON "members"
	FOR EACH ROW EXECUTE FUNCTION public.assign_member_code();--> statement-breakpoint
-- Backfill: existing members without a number or card get one now.
UPDATE "members" SET "member_code" = 'AFQ-' || lpad("id"::text, 5, '0') WHERE "member_code" IS NULL OR btrim("member_code") = '';--> statement-breakpoint
UPDATE "members" SET "card_status" = 'active', "card_issued_at" = COALESCE("card_issued_at", now()) WHERE "card_status" IS NULL OR "card_status" = 'none';--> statement-breakpoint
UPDATE "members" SET "joined_at" = "created_at"::date WHERE "created_at" IS NOT NULL;
--> statement-breakpoint
-- RLS: the board and task list hold personal data, same audience as the roster.
-- Tasks can also be run by project managers, since they link to projects.
ALTER TABLE "member_positions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "member_tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "admin_all_member_positions" ON "member_positions";--> statement-breakpoint
CREATE POLICY "admin_all_member_positions" ON "member_positions"
	FOR ALL USING (has_role('event_manager'));--> statement-breakpoint
DROP POLICY IF EXISTS "admin_all_member_tasks" ON "member_tasks";--> statement-breakpoint
CREATE POLICY "admin_all_member_tasks" ON "member_tasks"
	FOR ALL USING (has_role('event_manager') OR has_role('project_manager'));
