CREATE TABLE "department_managers" (
	"department_id" bigint NOT NULL,
	"admin_user_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "department_managers_department_id_admin_user_id_pk" PRIMARY KEY("department_id","admin_user_id")
);
--> statement-breakpoint
CREATE TABLE "member_departments" (
	"member_id" bigint NOT NULL,
	"department_id" bigint NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "member_departments_member_id_department_id_pk" PRIMARY KEY("member_id","department_id")
);
--> statement-breakpoint
CREATE TABLE "point_entries" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "point_entries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"member_id" bigint NOT NULL,
	"points" integer NOT NULL,
	"reason" text NOT NULL,
	"category" text DEFAULT 'other' NOT NULL,
	"task_id" bigint,
	"event_id" bigint,
	"awarded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "point_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"auto_enabled" boolean DEFAULT true NOT NULL,
	"task_done_points" integer DEFAULT 10 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "departments" ADD COLUMN "interests" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "department_managers" ADD CONSTRAINT "department_managers_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "department_managers" ADD CONSTRAINT "department_managers_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_departments" ADD CONSTRAINT "member_departments_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_departments" ADD CONSTRAINT "member_departments_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_entries" ADD CONSTRAINT "point_entries_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_entries" ADD CONSTRAINT "point_entries_task_id_member_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."member_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_entries" ADD CONSTRAINT "point_entries_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "member_departments_department_idx" ON "member_departments" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "point_entries_member_idx" ON "point_entries" USING btree ("member_id");--> statement-breakpoint
ALTER TABLE "member_departments" ADD CONSTRAINT "member_departments_source_check" CHECK ("source" IN ('interest', 'manual'));--> statement-breakpoint
ALTER TABLE "point_entries" ADD CONSTRAINT "point_entries_points_nonzero" CHECK ("points" <> 0);--> statement-breakpoint
ALTER TABLE "point_entries" ADD CONSTRAINT "point_entries_category_check" CHECK ("category" IN ('event', 'task', 'contribution', 'bonus', 'penalty', 'reset', 'other'));--> statement-breakpoint
ALTER TABLE "point_settings" ADD CONSTRAINT "point_settings_single_row" CHECK ("id" = 1);--> statement-breakpoint
INSERT INTO "point_settings" ("id") VALUES (1) ON CONFLICT DO NOTHING;--> statement-breakpoint
-- The owner sits above super admins: everything a super admin can do, and
-- only the owner can hand out, change or remove the owner account.
INSERT INTO "admin_roles" ("name", "label", "description") VALUES
	('owner', 'Owner', 'The club president. Full access; only the owner can change the owner account')
ON CONFLICT ("name") DO NOTHING;--> statement-breakpoint
INSERT INTO "admin_roles" ("name", "label", "description", "permissions") VALUES
	('hr_manager', 'HR Manager', 'Members, departments and points',
		ARRAY['applications.review', 'membership.manage', 'hr.manage', 'points.manage', 'tasks.manage', 'messages.view']),
	('department_head', 'Department Head', 'Sees the members and points of the departments they head',
		ARRAY['department.view', 'messages.view'])
ON CONFLICT ("name") DO NOTHING;--> statement-breakpoint
UPDATE "admin_users" SET "role_id" = (SELECT "id" FROM "admin_roles" WHERE "name" = 'owner')
	WHERE lower("email") = 'adam@afaq.dz';--> statement-breakpoint
-- Role checks: the owner passes every check a super admin passes.
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN AS $$
	SELECT EXISTS (
		SELECT 1 FROM admin_users au JOIN admin_roles r ON r.id = au.role_id
		WHERE au.user_id = auth.uid() AND au.is_active = true AND r.name = 'owner'
	);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
	RETURN EXISTS (
		SELECT 1 FROM admin_users au JOIN admin_roles r ON r.id = au.role_id
		WHERE au.user_id = auth.uid() AND au.is_active = true AND r.name IN ('super_admin', 'owner')
	);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.has_role(required_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
	RETURN EXISTS (
		SELECT 1 FROM admin_users au JOIN admin_roles r ON r.id = au.role_id
		WHERE au.user_id = auth.uid() AND au.is_active = true
			AND (r.name = required_role OR r.name IN ('super_admin', 'owner'))
	);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;--> statement-breakpoint
-- A permission from the role's saved list (admin_roles.permissions). Built-in
-- roles without a saved list only pass through the has_role() policies.
CREATE OR REPLACE FUNCTION public.has_permission(required TEXT)
RETURNS BOOLEAN AS $$
	SELECT EXISTS (
		SELECT 1 FROM admin_users au JOIN admin_roles r ON r.id = au.role_id
		WHERE au.user_id = auth.uid() AND au.is_active = true
			AND (r.name IN ('super_admin', 'owner') OR required = ANY (coalesce(r.permissions, '{}')))
	);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;--> statement-breakpoint
-- Whether the signed-in admin heads a department this member is in.
CREATE OR REPLACE FUNCTION public.heads_member(target BIGINT)
RETURNS BOOLEAN AS $$
	SELECT EXISTS (
		SELECT 1 FROM member_departments md
		JOIN department_managers dm ON dm.department_id = md.department_id
		JOIN admin_users au ON au.id = dm.admin_user_id
		WHERE md.member_id = target AND au.user_id = auth.uid() AND au.is_active = true
	);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;--> statement-breakpoint
-- Only the owner touches the owner's account or makes someone owner.
DROP POLICY IF EXISTS "owner_account_owner_only_update" ON "admin_users";--> statement-breakpoint
CREATE POLICY "owner_account_owner_only_update" ON "admin_users" AS RESTRICTIVE FOR UPDATE
	USING (is_owner() OR role_id <> (SELECT id FROM admin_roles WHERE name = 'owner'))
	WITH CHECK (is_owner() OR role_id <> (SELECT id FROM admin_roles WHERE name = 'owner'));--> statement-breakpoint
DROP POLICY IF EXISTS "owner_account_owner_only_delete" ON "admin_users";--> statement-breakpoint
CREATE POLICY "owner_account_owner_only_delete" ON "admin_users" AS RESTRICTIVE FOR DELETE
	USING (is_owner() OR role_id <> (SELECT id FROM admin_roles WHERE name = 'owner'));--> statement-breakpoint
DROP POLICY IF EXISTS "owner_account_owner_only_insert" ON "admin_users";--> statement-breakpoint
CREATE POLICY "owner_account_owner_only_insert" ON "admin_users" AS RESTRICTIVE FOR INSERT
	WITH CHECK (is_owner() OR role_id <> (SELECT id FROM admin_roles WHERE name = 'owner'));--> statement-breakpoint
-- The two top roles keep their meaning: only the owner edits them, nobody deletes them.
DROP POLICY IF EXISTS "top_roles_owner_only_update" ON "admin_roles";--> statement-breakpoint
CREATE POLICY "top_roles_owner_only_update" ON "admin_roles" AS RESTRICTIVE FOR UPDATE
	USING (is_owner() OR name NOT IN ('owner', 'super_admin'));--> statement-breakpoint
DROP POLICY IF EXISTS "top_roles_never_deleted" ON "admin_roles";--> statement-breakpoint
CREATE POLICY "top_roles_never_deleted" ON "admin_roles" AS RESTRICTIVE FOR DELETE
	USING (name NOT IN ('owner', 'super_admin'));--> statement-breakpoint
-- HR picks department heads, so it reads the admin list.
DROP POLICY IF EXISTS "hr_read_admin_users" ON "admin_users";--> statement-breakpoint
CREATE POLICY "hr_read_admin_users" ON "admin_users" FOR SELECT USING (has_permission('hr.manage'));--> statement-breakpoint
DROP POLICY IF EXISTS "super admins read activity" ON "activity_logs";--> statement-breakpoint
CREATE POLICY "super admins read activity" ON "activity_logs" FOR SELECT TO authenticated USING (is_super_admin());--> statement-breakpoint
-- Roles made in the console (HR) reach the roster through their permissions,
-- next to the built-in has_role() policies.
DROP POLICY IF EXISTS "perm_all_members" ON "members";--> statement-breakpoint
CREATE POLICY "perm_all_members" ON "members" FOR ALL USING (has_permission('membership.manage')) WITH CHECK (has_permission('membership.manage'));--> statement-breakpoint
DROP POLICY IF EXISTS "head_read_members" ON "members";--> statement-breakpoint
CREATE POLICY "head_read_members" ON "members" FOR SELECT USING (heads_member(id));--> statement-breakpoint
DROP POLICY IF EXISTS "perm_all_member_positions" ON "member_positions";--> statement-breakpoint
CREATE POLICY "perm_all_member_positions" ON "member_positions" FOR ALL USING (has_permission('membership.manage')) WITH CHECK (has_permission('membership.manage'));--> statement-breakpoint
DROP POLICY IF EXISTS "head_read_member_positions" ON "member_positions";--> statement-breakpoint
CREATE POLICY "head_read_member_positions" ON "member_positions" FOR SELECT USING (heads_member(member_id));--> statement-breakpoint
DROP POLICY IF EXISTS "perm_all_member_roles" ON "member_roles";--> statement-breakpoint
CREATE POLICY "perm_all_member_roles" ON "member_roles" FOR ALL USING (has_permission('membership.manage')) WITH CHECK (has_permission('membership.manage'));--> statement-breakpoint
DROP POLICY IF EXISTS "perm_all_member_groups" ON "member_groups";--> statement-breakpoint
CREATE POLICY "perm_all_member_groups" ON "member_groups" FOR ALL USING (has_permission('membership.manage')) WITH CHECK (has_permission('membership.manage'));--> statement-breakpoint
DROP POLICY IF EXISTS "perm_all_member_group_members" ON "member_group_members";--> statement-breakpoint
CREATE POLICY "perm_all_member_group_members" ON "member_group_members" FOR ALL USING (has_permission('membership.manage')) WITH CHECK (has_permission('membership.manage'));--> statement-breakpoint
DROP POLICY IF EXISTS "perm_all_membership_applications" ON "membership_applications";--> statement-breakpoint
CREATE POLICY "perm_all_membership_applications" ON "membership_applications" FOR ALL USING (has_permission('membership.manage')) WITH CHECK (has_permission('membership.manage'));--> statement-breakpoint
DROP POLICY IF EXISTS "perm_all_interests" ON "interests";--> statement-breakpoint
CREATE POLICY "perm_all_interests" ON "interests" FOR ALL USING (has_permission('membership.manage')) WITH CHECK (has_permission('membership.manage'));--> statement-breakpoint
DROP POLICY IF EXISTS "perm_all_review_teams" ON "review_teams";--> statement-breakpoint
CREATE POLICY "perm_all_review_teams" ON "review_teams" FOR ALL USING (has_permission('membership.manage')) WITH CHECK (has_permission('membership.manage'));--> statement-breakpoint
DROP POLICY IF EXISTS "perm_all_interest_teams" ON "interest_teams";--> statement-breakpoint
CREATE POLICY "perm_all_interest_teams" ON "interest_teams" FOR ALL USING (has_permission('membership.manage')) WITH CHECK (has_permission('membership.manage'));--> statement-breakpoint
DROP POLICY IF EXISTS "perm_all_team_reviewers" ON "team_reviewers";--> statement-breakpoint
CREATE POLICY "perm_all_team_reviewers" ON "team_reviewers" FOR ALL USING (has_permission('membership.manage')) WITH CHECK (has_permission('membership.manage'));--> statement-breakpoint
DROP POLICY IF EXISTS "perm_all_review_settings" ON "review_settings";--> statement-breakpoint
CREATE POLICY "perm_all_review_settings" ON "review_settings" FOR ALL USING (has_permission('membership.manage')) WITH CHECK (has_permission('membership.manage'));--> statement-breakpoint
DROP POLICY IF EXISTS "perm_read_application_events" ON "application_events";--> statement-breakpoint
CREATE POLICY "perm_read_application_events" ON "application_events" FOR SELECT USING (has_permission('membership.manage'));--> statement-breakpoint
DROP POLICY IF EXISTS "perm_all_member_tasks" ON "member_tasks";--> statement-breakpoint
CREATE POLICY "perm_all_member_tasks" ON "member_tasks" FOR ALL USING (has_permission('tasks.manage')) WITH CHECK (has_permission('tasks.manage'));--> statement-breakpoint
ALTER TABLE "member_departments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "department_managers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "point_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "point_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "membership_all_member_departments" ON "member_departments";--> statement-breakpoint
CREATE POLICY "membership_all_member_departments" ON "member_departments" FOR ALL
	USING (has_role('event_manager') OR has_permission('membership.manage'))
	WITH CHECK (has_role('event_manager') OR has_permission('membership.manage'));--> statement-breakpoint
DROP POLICY IF EXISTS "head_read_member_departments" ON "member_departments";--> statement-breakpoint
CREATE POLICY "head_read_member_departments" ON "member_departments" FOR SELECT USING (heads_member(member_id));--> statement-breakpoint
DROP POLICY IF EXISTS "admin_read_department_managers" ON "department_managers";--> statement-breakpoint
CREATE POLICY "admin_read_department_managers" ON "department_managers" FOR SELECT USING (EXISTS (
	SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true
));--> statement-breakpoint
DROP POLICY IF EXISTS "hr_write_department_managers" ON "department_managers";--> statement-breakpoint
CREATE POLICY "hr_write_department_managers" ON "department_managers" FOR ALL
	USING (has_permission('hr.manage')) WITH CHECK (has_permission('hr.manage'));--> statement-breakpoint
-- Points: HR and super admins see and give them; a department head only sees
-- the points of the members in their departments. Rows are never edited.
DROP POLICY IF EXISTS "points_read" ON "point_entries";--> statement-breakpoint
CREATE POLICY "points_read" ON "point_entries" FOR SELECT USING (has_permission('points.manage') OR heads_member(member_id));--> statement-breakpoint
DROP POLICY IF EXISTS "points_give" ON "point_entries";--> statement-breakpoint
CREATE POLICY "points_give" ON "point_entries" FOR INSERT WITH CHECK (has_permission('points.manage') AND awarded_by = auth.uid());--> statement-breakpoint
DROP POLICY IF EXISTS "points_delete" ON "point_entries";--> statement-breakpoint
CREATE POLICY "points_delete" ON "point_entries" FOR DELETE USING (is_super_admin());--> statement-breakpoint
DROP POLICY IF EXISTS "admin_read_point_settings" ON "point_settings";--> statement-breakpoint
CREATE POLICY "admin_read_point_settings" ON "point_settings" FOR SELECT USING (EXISTS (
	SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true
));--> statement-breakpoint
DROP POLICY IF EXISTS "points_write_point_settings" ON "point_settings";--> statement-breakpoint
CREATE POLICY "points_write_point_settings" ON "point_settings" FOR UPDATE
	USING (has_permission('points.manage')) WITH CHECK (has_permission('points.manage'));--> statement-breakpoint
-- Departments a member's interests point to. Only 'interest' rows are synced;
-- rows added by hand stay until someone removes them.
CREATE OR REPLACE FUNCTION public.members_assign_departments()
RETURNS TRIGGER AS $$
BEGIN
	DELETE FROM member_departments md
	USING departments d
	WHERE md.member_id = NEW.id AND md.source = 'interest' AND d.id = md.department_id
		AND NOT (d.interests && coalesce(NEW.interests, '{}'));
	INSERT INTO member_departments (member_id, department_id, source)
	SELECT NEW.id, d.id, 'interest' FROM departments d
	WHERE d.interests && coalesce(NEW.interests, '{}')
	ON CONFLICT DO NOTHING;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;--> statement-breakpoint
DROP TRIGGER IF EXISTS "members_assign_departments" ON "members";--> statement-breakpoint
CREATE TRIGGER "members_assign_departments" AFTER INSERT OR UPDATE OF "interests" ON "members"
	FOR EACH ROW EXECUTE FUNCTION public.members_assign_departments();--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.departments_sync_members()
RETURNS TRIGGER AS $$
BEGIN
	DELETE FROM member_departments md
	USING members m
	WHERE md.department_id = NEW.id AND md.source = 'interest' AND m.id = md.member_id
		AND NOT (NEW.interests && coalesce(m.interests, '{}'));
	INSERT INTO member_departments (member_id, department_id, source)
	SELECT m.id, NEW.id, 'interest' FROM members m
	WHERE NEW.interests && coalesce(m.interests, '{}')
	ON CONFLICT DO NOTHING;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;--> statement-breakpoint
DROP TRIGGER IF EXISTS "departments_sync_members" ON "departments";--> statement-breakpoint
CREATE TRIGGER "departments_sync_members" AFTER INSERT OR UPDATE OF "interests" ON "departments"
	FOR EACH ROW EXECUTE FUNCTION public.departments_sync_members();--> statement-breakpoint
-- Automatic points for a finished task, once per task.
CREATE OR REPLACE FUNCTION public.member_tasks_award_points()
RETURNS TRIGGER AS $$
DECLARE
	s point_settings;
BEGIN
	IF NEW.status IS DISTINCT FROM 'done' OR NEW.assignee_id IS NULL OR (TG_OP = 'UPDATE' AND OLD.status = 'done') THEN
		RETURN NEW;
	END IF;
	SELECT * INTO s FROM point_settings WHERE id = 1;
	IF NOT FOUND OR NOT s.auto_enabled OR s.task_done_points = 0 THEN
		RETURN NEW;
	END IF;
	IF EXISTS (SELECT 1 FROM point_entries WHERE task_id = NEW.id AND category = 'task') THEN
		RETURN NEW;
	END IF;
	INSERT INTO point_entries (member_id, points, reason, category, task_id)
	VALUES (NEW.assignee_id, s.task_done_points, 'Task done: ' || NEW.title, 'task', NEW.id);
	RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;--> statement-breakpoint
DROP TRIGGER IF EXISTS "member_tasks_award_points" ON "member_tasks";--> statement-breakpoint
CREATE TRIGGER "member_tasks_award_points" AFTER INSERT OR UPDATE OF "status" ON "member_tasks"
	FOR EACH ROW EXECUTE FUNCTION public.member_tasks_award_points();--> statement-breakpoint
-- Starting departments and the interests that fill them. Setting interests
-- fires departments_sync_members, which places the existing members.
INSERT INTO "departments" ("name", "color", "sort_order") VALUES
	('Languages', '#7c3aed', 4),
	('HR', '#16a34a', 5)
ON CONFLICT ("name") DO NOTHING;--> statement-breakpoint
UPDATE "departments" SET "interests" = ARRAY['robotics', 'programming', 'electronics', 'iot', 'ai', 'web'] WHERE "name" = 'Tech';--> statement-breakpoint
UPDATE "departments" SET "interests" = ARRAY['design', 'photo_video', 'content'] WHERE "name" = 'Media';--> statement-breakpoint
UPDATE "departments" SET "interests" = ARRAY['languages'] WHERE "name" = 'Languages';
