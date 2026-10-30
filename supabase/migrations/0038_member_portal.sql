CREATE TABLE "member_notice_reads" (
	"notice_id" bigint NOT NULL,
	"member_id" bigint NOT NULL,
	"read_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "member_notice_reads_notice_id_member_id_pk" PRIMARY KEY("notice_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "member_notice_targets" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "member_notice_targets_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"notice_id" bigint NOT NULL,
	"department_id" bigint,
	"group_id" bigint,
	"member_id" bigint
);
--> statement-breakpoint
CREATE TABLE "member_notices" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "member_notices_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"title" text NOT NULL,
	"body" text NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone,
	"emailed_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "event_registrations" ADD COLUMN "member_id" bigint;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "portal_invited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "member_notice_reads" ADD CONSTRAINT "member_notice_reads_notice_id_member_notices_id_fk" FOREIGN KEY ("notice_id") REFERENCES "public"."member_notices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_notice_reads" ADD CONSTRAINT "member_notice_reads_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_notice_targets" ADD CONSTRAINT "member_notice_targets_notice_id_member_notices_id_fk" FOREIGN KEY ("notice_id") REFERENCES "public"."member_notices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_notice_targets" ADD CONSTRAINT "member_notice_targets_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_notice_targets" ADD CONSTRAINT "member_notice_targets_group_id_member_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."member_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_notice_targets" ADD CONSTRAINT "member_notice_targets_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "member_notice_targets_notice_idx" ON "member_notice_targets" USING btree ("notice_id");--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_user_id_unique" UNIQUE("user_id");--> statement-breakpoint
ALTER TABLE "member_notices" ADD CONSTRAINT "member_notices_priority_check" CHECK ("priority" IN ('normal', 'important'));--> statement-breakpoint
ALTER TABLE "member_notice_targets" ADD CONSTRAINT "member_notice_targets_one_check" CHECK (num_nonnulls("department_id", "group_id", "member_id") = 1);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_registrations_member_idx" ON "event_registrations" USING btree ("member_id");--> statement-breakpoint
-- Link past registrations to the member with the same email.
UPDATE event_registrations r SET member_id = m.id
FROM members m WHERE r.member_id IS NULL AND lower(r.email) = lower(m.email);--> statement-breakpoint
-- Notices are written in the console by whoever manages announcements. Members
-- never touch these tables directly; they read through the portal_* functions.
ALTER TABLE "member_notices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "member_notice_targets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "member_notice_reads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "notices_manage" ON "member_notices";--> statement-breakpoint
CREATE POLICY "notices_manage" ON "member_notices" FOR ALL
	USING (has_permission('announcements.manage')) WITH CHECK (has_permission('announcements.manage'));--> statement-breakpoint
DROP POLICY IF EXISTS "notice_targets_manage" ON "member_notice_targets";--> statement-breakpoint
CREATE POLICY "notice_targets_manage" ON "member_notice_targets" FOR ALL
	USING (has_permission('announcements.manage')) WITH CHECK (has_permission('announcements.manage'));--> statement-breakpoint
DROP POLICY IF EXISTS "notice_reads_read" ON "member_notice_reads";--> statement-breakpoint
CREATE POLICY "notice_reads_read" ON "member_notice_reads" FOR SELECT USING (has_permission('announcements.manage'));--> statement-breakpoint
-- The member signed in to the portal. Suspended members are locked out.
CREATE OR REPLACE FUNCTION public.current_member_id()
RETURNS BIGINT AS $$
	SELECT id FROM members
	WHERE auth.uid() IS NOT NULL AND user_id = auth.uid() AND coalesce(status, 'active') <> 'suspended'
	LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;--> statement-breakpoint
-- The server looks up an existing auth account before inviting a member.
CREATE OR REPLACE FUNCTION public.auth_user_id_by_email(p_email TEXT)
RETURNS UUID AS $$
	SELECT id FROM auth.users WHERE lower(email) = lower(p_email) LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.auth_user_id_by_email(TEXT) FROM PUBLIC, anon, authenticated;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.auth_user_id_by_email(TEXT) TO service_role;--> statement-breakpoint
-- Profile, departments, offices, groups and points standing, without HR-only
-- fields (notes, birth date, gender). Rank counts active members only and
-- never reveals who is above or below.
CREATE OR REPLACE FUNCTION public.portal_me()
RETURNS JSONB AS $$
DECLARE
	me BIGINT := current_member_id();
	result JSONB;
BEGIN
	IF me IS NULL THEN RETURN NULL; END IF;
	WITH totals AS (
		SELECT m.id, coalesce(sum(p.points), 0)::int AS points
		FROM members m LEFT JOIN point_entries p ON p.member_id = m.id
		WHERE coalesce(m.status, 'active') = 'active'
		GROUP BY m.id
	), mine AS (
		SELECT coalesce(sum(points), 0)::int AS points FROM point_entries WHERE member_id = me
	)
	SELECT jsonb_build_object(
		'id', m.id,
		'member_code', m.member_code,
		'full_name', m.full_name,
		'email', m.email,
		'phone', m.phone,
		'student_id', m.student_id,
		'study_department', m.department,
		'study_year', m.study_year,
		'skills', coalesce(m.skills, '{}'),
		'interests', coalesce(m.interests, '{}'),
		'photo_url', m.photo_url,
		'team', m.team,
		'status', coalesce(m.status, 'active'),
		'joined_at', m.joined_at,
		'email_opt_out', m.email_opt_out,
		'card_status', m.card_status,
		'points', (SELECT points FROM mine),
		'rank', CASE WHEN coalesce(m.status, 'active') = 'active'
			THEN 1 + (SELECT count(*) FROM totals t WHERE t.points > (SELECT points FROM mine)) END,
		'ranked', (SELECT count(*) FROM totals),
		'departments', (
			SELECT coalesce(jsonb_agg(jsonb_build_object(
				'id', d.id, 'name', d.name, 'color', d.color, 'description', d.description,
				'size', (SELECT count(*) FROM member_departments x JOIN totals t ON t.id = x.member_id WHERE x.department_id = d.id),
				'rank', CASE WHEN coalesce(m.status, 'active') = 'active' THEN 1 + (
					SELECT count(*) FROM member_departments x JOIN totals t ON t.id = x.member_id
					WHERE x.department_id = d.id AND t.points > (SELECT points FROM mine)) END
			) ORDER BY d.sort_order, d.name), '[]'::jsonb)
			FROM member_departments md JOIN departments d ON d.id = md.department_id
			WHERE md.member_id = me
		),
		'positions', (
			SELECT coalesce(jsonb_agg(jsonb_build_object(
				'title', mp.title, 'team', mp.team, 'term_start', mp.term_start, 'term_end', mp.term_end
			) ORDER BY mp.term_start DESC), '[]'::jsonb)
			FROM member_positions mp WHERE mp.member_id = me
		),
		'groups', (
			SELECT coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name) ORDER BY g.name), '[]'::jsonb)
			FROM member_group_members gm JOIN member_groups g ON g.id = gm.group_id
			WHERE gm.member_id = me
		)
	) INTO result
	FROM members m WHERE m.id = me;
	RETURN result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.portal_points()
RETURNS TABLE (id BIGINT, points INT, reason TEXT, category TEXT, event_title TEXT, created_at TIMESTAMPTZ) AS $$
	SELECT p.id, p.points, p.reason, p.category, e.title_en, p.created_at
	FROM point_entries p LEFT JOIN events e ON e.id = p.event_id
	WHERE p.member_id = current_member_id()
	ORDER BY p.created_at DESC, p.id DESC;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.portal_tasks()
RETURNS TABLE (id BIGINT, title TEXT, description TEXT, status TEXT, priority TEXT, due_date DATE, completed_at TIMESTAMPTZ, project_title TEXT) AS $$
	SELECT t.id, t.title, t.description, t.status, t.priority, t.due_date, t.completed_at, pr.title_en
	FROM member_tasks t LEFT JOIN projects pr ON pr.id = t.project_id
	WHERE t.assignee_id = current_member_id()
	ORDER BY (t.status = 'done'), t.due_date NULLS LAST, t.created_at DESC;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;--> statement-breakpoint
-- Upcoming published events, plus any past event the member registered for.
CREATE OR REPLACE FUNCTION public.portal_events()
RETURNS TABLE (
	id BIGINT, title_en TEXT, title_ar TEXT, title_fr TEXT,
	description_en TEXT, description_ar TEXT, description_fr TEXT,
	date DATE, "time" TIME, location_en TEXT, location_ar TEXT, location_fr TEXT,
	poster_url TEXT, registration_open BOOLEAN, is_full BOOLEAN, registration_status TEXT
) AS $$
	WITH me AS (SELECT m.id, m.email FROM members m WHERE m.id = current_member_id())
	SELECT e.id, e.title_en, e.title_ar, e.title_fr,
		e.description_en, e.description_ar, e.description_fr,
		e.date, e.time, e.location_en, e.location_ar, e.location_fr,
		e.poster_url, coalesce(e.registration_open, false),
		coalesce(e.max_participants, 0) > 0 AND (
			SELECT count(*) FROM event_registrations x WHERE x.event_id = e.id AND x.status = 'approved'
		) >= e.max_participants,
		r.status
	FROM events e
	CROSS JOIN me
	LEFT JOIN LATERAL (
		SELECT x.status FROM event_registrations x
		WHERE x.event_id = e.id AND (x.member_id = me.id OR lower(x.email) = lower(me.email))
		ORDER BY x.created_at DESC LIMIT 1
	) r ON true
	WHERE e.is_published = true AND (e.date >= current_date OR r.status IS NOT NULL)
	ORDER BY (e.date < current_date), CASE WHEN e.date >= current_date THEN e.date END, e.date DESC;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;--> statement-breakpoint
-- One-tap registration with the member's own details; same rules as the
-- public form (published, open, not past, not full, once per person).
CREATE OR REPLACE FUNCTION public.portal_register_event(p_event_id BIGINT)
RETURNS TEXT AS $$
DECLARE
	me members%ROWTYPE;
	ev events%ROWTYPE;
BEGIN
	SELECT * INTO me FROM members WHERE id = current_member_id();
	IF me.id IS NULL THEN RAISE EXCEPTION 'not_a_member' USING ERRCODE = '42501'; END IF;
	SELECT * INTO ev FROM events WHERE id = p_event_id FOR UPDATE;
	IF ev.id IS NULL OR NOT coalesce(ev.is_published, false) THEN RETURN 'unavailable'; END IF;
	IF NOT coalesce(ev.registration_open, false) OR ev.date < current_date THEN RETURN 'closed'; END IF;
	IF EXISTS (
		SELECT 1 FROM event_registrations x
		WHERE x.event_id = ev.id AND (x.member_id = me.id OR lower(x.email) = lower(me.email))
	) THEN RETURN 'duplicate'; END IF;
	IF coalesce(ev.max_participants, 0) > 0 AND (
		SELECT count(*) FROM event_registrations x WHERE x.event_id = ev.id AND x.status = 'approved'
	) >= ev.max_participants THEN RETURN 'full'; END IF;
	INSERT INTO event_registrations (event_id, member_id, full_name, email, phone, student_id, department, study_year, agreed_to_policies)
	VALUES (ev.id, me.id, me.full_name, lower(me.email), me.phone, me.student_id, me.department, me.study_year, true);
	RETURN 'ok';
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public;--> statement-breakpoint
-- Whether a member is in a notice's audience (no targets = everyone).
CREATE OR REPLACE FUNCTION public.notice_reaches(p_notice_id BIGINT, p_member_id BIGINT)
RETURNS BOOLEAN AS $$
	SELECT NOT EXISTS (SELECT 1 FROM member_notice_targets t WHERE t.notice_id = p_notice_id)
		OR EXISTS (
			SELECT 1 FROM member_notice_targets t
			WHERE t.notice_id = p_notice_id AND (
				t.member_id = p_member_id
				OR t.department_id IN (SELECT department_id FROM member_departments WHERE member_id = p_member_id)
				OR t.group_id IN (SELECT group_id FROM member_group_members WHERE member_id = p_member_id)
			)
		);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.notice_reaches(BIGINT, BIGINT) FROM PUBLIC, anon, authenticated;--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.portal_notices()
RETURNS TABLE (id BIGINT, title TEXT, body TEXT, priority TEXT, is_pinned BOOLEAN, created_at TIMESTAMPTZ, is_read BOOLEAN) AS $$
	SELECT n.id, n.title, n.body, n.priority, n.is_pinned, n.created_at,
		EXISTS (SELECT 1 FROM member_notice_reads r WHERE r.notice_id = n.id AND r.member_id = current_member_id())
	FROM member_notices n
	WHERE current_member_id() IS NOT NULL
		AND (n.expires_at IS NULL OR n.expires_at > now())
		AND notice_reaches(n.id, current_member_id())
	ORDER BY n.is_pinned DESC, n.created_at DESC
	LIMIT 100;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.portal_read_notices(p_ids BIGINT[])
RETURNS VOID AS $$
	INSERT INTO member_notice_reads (notice_id, member_id)
	SELECT n.id, current_member_id() FROM member_notices n
	WHERE n.id = ANY (p_ids) AND current_member_id() IS NOT NULL AND notice_reaches(n.id, current_member_id())
	ON CONFLICT DO NOTHING;
$$ LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public;--> statement-breakpoint
-- The few fields a member keeps up to date themselves. Everything else
-- (name, code, status, departments) stays with HR.
CREATE OR REPLACE FUNCTION public.portal_update_profile(p_phone TEXT, p_skills TEXT[], p_email_opt_out BOOLEAN)
RETURNS VOID AS $$
BEGIN
	IF current_member_id() IS NULL THEN RAISE EXCEPTION 'not_a_member' USING ERRCODE = '42501'; END IF;
	IF length(coalesce(p_phone, '')) > 40 OR coalesce(array_length(p_skills, 1), 0) > 30 THEN
		RAISE EXCEPTION 'too_long' USING ERRCODE = '22001';
	END IF;
	UPDATE members SET
		phone = nullif(btrim(coalesce(p_phone, '')), ''),
		skills = (SELECT coalesce(array_agg(left(btrim(s), 60)), '{}') FROM unnest(coalesce(p_skills, '{}')) s WHERE btrim(s) <> ''),
		email_opt_out = coalesce(p_email_opt_out, email_opt_out),
		updated_at = now()
	WHERE id = current_member_id();
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.current_member_id() FROM PUBLIC, anon;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.portal_me() FROM PUBLIC, anon;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.portal_points() FROM PUBLIC, anon;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.portal_tasks() FROM PUBLIC, anon;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.portal_events() FROM PUBLIC, anon;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.portal_register_event(BIGINT) FROM PUBLIC, anon;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.portal_notices() FROM PUBLIC, anon;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.portal_read_notices(BIGINT[]) FROM PUBLIC, anon;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.portal_update_profile(TEXT, TEXT[], BOOLEAN) FROM PUBLIC, anon;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.current_member_id(), public.portal_me(), public.portal_points(), public.portal_tasks(),
	public.portal_events(), public.portal_register_event(BIGINT), public.portal_notices(),
	public.portal_read_notices(BIGINT[]), public.portal_update_profile(TEXT, TEXT[], BOOLEAN) TO authenticated;
