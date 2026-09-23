CREATE TABLE "member_roles" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "member_roles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "member_roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
-- RLS: same audience as member_positions, since roles are picked when assigning them.
ALTER TABLE "member_roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "admin_all_member_roles" ON "member_roles";--> statement-breakpoint
CREATE POLICY "admin_all_member_roles" ON "member_roles"
	FOR ALL USING (has_role('event_manager'));
