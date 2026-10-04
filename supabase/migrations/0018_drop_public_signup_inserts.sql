-- Event registrations and membership applications are inserted only by the
-- server (/api/register/*) with the service role, which enforces capacity,
-- duplicate, closed-event and rate-limit rules. The anon INSERT policies let
-- anyone skip all of that by posting straight to the table with the public
-- key, including rows pre-set to status = 'approved'.
DROP POLICY IF EXISTS "public_insert_event_registrations" ON "event_registrations";--> statement-breakpoint
DROP POLICY IF EXISTS "public_insert_membership_applications" ON "membership_applications";
