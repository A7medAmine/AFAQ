ALTER TABLE "members" ADD COLUMN "preferred_name" text;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "photo_pending_url" text;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "photo_pending_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "photo_review_note" text;
--> statement-breakpoint
-- Words of the registered name only, any subset, in any order.
CREATE OR REPLACE FUNCTION public.name_uses_own_words(p_name TEXT, p_full_name TEXT)
RETURNS BOOLEAN AS $$
	SELECT regexp_split_to_array(lower(btrim(p_name)), '\s+') <@ regexp_split_to_array(lower(btrim(p_full_name)), '\s+');
$$ LANGUAGE sql IMMUTABLE SET search_path = public;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_preferred_name_check"
	CHECK (preferred_name IS NULL OR name_uses_own_words(preferred_name, full_name));--> statement-breakpoint
-- The portal shows the preferred name and the photo waiting for review.
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
		'must_change_password', m.portal_must_change_password,
		'preferred_name', m.preferred_name,
		'photo_pending_url', m.photo_pending_url,
		'photo_review_note', m.photo_review_note,
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
DROP FUNCTION IF EXISTS public.portal_update_profile(TEXT, TEXT[], BOOLEAN);--> statement-breakpoint
-- The few fields a member keeps up to date themselves. The preferred name can
-- only be built from words of the registered name; everything else (name,
-- code, status, departments) stays with HR.
CREATE OR REPLACE FUNCTION public.portal_update_profile(p_phone TEXT, p_skills TEXT[], p_email_opt_out BOOLEAN, p_preferred_name TEXT)
RETURNS VOID AS $$
DECLARE
	me members%ROWTYPE;
	wanted TEXT := nullif(regexp_replace(btrim(coalesce(p_preferred_name, '')), '\s+', ' ', 'g'), '');
BEGIN
	SELECT * INTO me FROM members WHERE id = current_member_id();
	IF me.id IS NULL THEN RAISE EXCEPTION 'not_a_member' USING ERRCODE = '42501'; END IF;
	IF length(coalesce(p_phone, '')) > 40 OR coalesce(array_length(p_skills, 1), 0) > 30 THEN
		RAISE EXCEPTION 'too_long' USING ERRCODE = '22001';
	END IF;
	IF wanted IS NOT NULL AND NOT name_uses_own_words(wanted, me.full_name) THEN
		RAISE EXCEPTION 'name_not_allowed' USING ERRCODE = '22023';
	END IF;
	UPDATE members SET
		phone = nullif(btrim(coalesce(p_phone, '')), ''),
		skills = (SELECT coalesce(array_agg(left(btrim(s), 60)), '{}') FROM unnest(coalesce(p_skills, '{}')) s WHERE btrim(s) <> ''),
		email_opt_out = coalesce(p_email_opt_out, email_opt_out),
		-- Showing the whole registered name is the default, so store nothing.
		preferred_name = CASE WHEN lower(wanted) = lower(regexp_replace(btrim(me.full_name), '\s+', ' ', 'g')) THEN NULL ELSE wanted END,
		updated_at = now()
	WHERE id = me.id;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.portal_update_profile(TEXT, TEXT[], BOOLEAN, TEXT) FROM PUBLIC, anon;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.portal_update_profile(TEXT, TEXT[], BOOLEAN, TEXT) TO authenticated;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.portal_me() FROM PUBLIC, anon;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.portal_me() TO authenticated;
