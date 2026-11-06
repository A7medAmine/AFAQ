-- Member of the month: the active member with the most points over the last
-- calendar month (Algiers time). Penalties count against the total, resets do
-- not, and members who tie share the title. A member only learns whether they
-- hold it themselves, never who else does or anyone else's points.
CREATE OR REPLACE FUNCTION public.portal_member_of_month()
RETURNS JSONB AS $$
DECLARE
	me BIGINT := current_member_id();
	local_now TIMESTAMP := now() AT TIME ZONE 'Africa/Algiers';
	month_start TIMESTAMP := date_trunc('month', local_now - interval '1 month');
	month_end TIMESTAMP := date_trunc('month', local_now);
	result JSONB;
BEGIN
	IF me IS NULL THEN RETURN NULL; END IF;
	WITH earned AS (
		SELECT p.member_id, sum(p.points)::int AS points
		FROM point_entries p JOIN members m ON m.id = p.member_id
		WHERE p.category <> 'reset'
			AND p.created_at >= month_start AT TIME ZONE 'Africa/Algiers'
			AND p.created_at < month_end AT TIME ZONE 'Africa/Algiers'
			AND coalesce(m.status, 'active') = 'active'
		GROUP BY p.member_id
		HAVING sum(p.points) > 0
	)
	SELECT jsonb_build_object('month', to_char(month_start, 'YYYY-MM'), 'points', e.points)
	INTO result
	FROM earned e
	WHERE e.member_id = me AND e.points = (SELECT max(points) FROM earned);
	RETURN result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.portal_member_of_month() FROM PUBLIC, anon;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.portal_member_of_month() TO authenticated;
