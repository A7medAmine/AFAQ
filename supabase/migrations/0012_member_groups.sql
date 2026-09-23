CREATE TABLE "member_group_members" (
	"group_id" bigint NOT NULL,
	"member_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "member_group_members_group_id_member_id_pk" PRIMARY KEY("group_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "member_groups" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "member_groups_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "member_groups_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "member_group_members" ADD CONSTRAINT "member_group_members_group_id_member_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."member_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_group_members" ADD CONSTRAINT "member_group_members_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- RLS: same audience as the roster.
ALTER TABLE "member_groups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "member_group_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "admin_all_member_groups" ON "member_groups";--> statement-breakpoint
CREATE POLICY "admin_all_member_groups" ON "member_groups"
	FOR ALL USING (has_role('event_manager'));--> statement-breakpoint
DROP POLICY IF EXISTS "admin_all_member_group_members" ON "member_group_members";--> statement-breakpoint
CREATE POLICY "admin_all_member_group_members" ON "member_group_members"
	FOR ALL USING (has_role('event_manager'));
