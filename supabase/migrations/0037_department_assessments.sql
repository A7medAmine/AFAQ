CREATE TABLE "member_assessments" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "member_assessments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"member_id" bigint NOT NULL,
	"department_id" bigint NOT NULL,
	"answers" integer[] DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"practical" text DEFAULT 'not_required' NOT NULL,
	"notes" text,
	"interviewed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "member_assessments_member_department_key" UNIQUE("member_id","department_id")
);
--> statement-breakpoint
ALTER TABLE "member_assessments" ADD CONSTRAINT "member_assessments_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_assessments" ADD CONSTRAINT "member_assessments_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "member_assessments_department_idx" ON "member_assessments" USING btree ("department_id");--> statement-breakpoint
ALTER TABLE "member_assessments" ADD CONSTRAINT "member_assessments_status_check" CHECK ("status" IN ('pending', 'completed', 'absent'));--> statement-breakpoint
ALTER TABLE "member_assessments" ADD CONSTRAINT "member_assessments_practical_check" CHECK ("practical" IN ('not_required', 'pending', 'passed', 'not_passed'));--> statement-breakpoint
ALTER TABLE "member_assessments" ADD CONSTRAINT "member_assessments_answers_check" CHECK (0 <= ALL ("answers") AND 3 >= ALL ("answers"));--> statement-breakpoint
-- Whether the signed-in admin heads this department.
CREATE OR REPLACE FUNCTION public.heads_department(target BIGINT)
RETURNS BOOLEAN AS $$
	SELECT EXISTS (
		SELECT 1 FROM department_managers dm
		JOIN admin_users au ON au.id = dm.admin_user_id
		WHERE dm.department_id = target AND au.user_id = auth.uid() AND au.is_active = true
	);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;--> statement-breakpoint
-- HR runs any department's interviews; a head runs their own department's.
ALTER TABLE "member_assessments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "assessments_all" ON "member_assessments";--> statement-breakpoint
CREATE POLICY "assessments_all" ON "member_assessments" FOR ALL
	USING (has_permission('hr.manage') OR heads_department(department_id))
	WITH CHECK (has_permission('hr.manage') OR heads_department(department_id));--> statement-breakpoint
-- A department head reads the application (and its motivation letter) of the
-- members in their departments.
DROP POLICY IF EXISTS "head_read_membership_applications" ON "membership_applications";--> statement-breakpoint
CREATE POLICY "head_read_membership_applications" ON "membership_applications" FOR SELECT USING (EXISTS (
	SELECT 1 FROM members m WHERE m.application_id = membership_applications.id AND heads_member(m.id)
));
