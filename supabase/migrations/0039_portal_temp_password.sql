ALTER TABLE "members" ADD COLUMN "portal_must_change_password" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
-- Expose the temporary-password flag so the portal can ask for a new password.
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
REVOKE ALL ON FUNCTION public.portal_me() FROM PUBLIC, anon;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.portal_me() TO authenticated;
