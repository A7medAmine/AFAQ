CREATE TABLE "point_presets" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "point_presets_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"label" text NOT NULL,
	"points" integer NOT NULL,
	"category" text DEFAULT 'other' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "point_presets" ADD CONSTRAINT "point_presets_points_nonzero" CHECK ("points" <> 0);--> statement-breakpoint
ALTER TABLE "point_presets" ADD CONSTRAINT "point_presets_category_check" CHECK ("category" IN ('event', 'task', 'contribution', 'bonus', 'penalty', 'other'));--> statement-breakpoint
ALTER TABLE "point_presets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "admin_read_point_presets" ON "point_presets";--> statement-breakpoint
CREATE POLICY "admin_read_point_presets" ON "point_presets" FOR SELECT USING (EXISTS (
	SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true
));--> statement-breakpoint
DROP POLICY IF EXISTS "points_write_point_presets" ON "point_presets";--> statement-breakpoint
CREATE POLICY "points_write_point_presets" ON "point_presets" FOR ALL
	USING (has_permission('points.manage')) WITH CHECK (has_permission('points.manage'));--> statement-breakpoint
-- Undo: whoever gave points can take back their own rows for ten minutes.
-- After that the ledger is fixed; a correction is a new row.
DROP POLICY IF EXISTS "points_undo_own" ON "point_entries";--> statement-breakpoint
CREATE POLICY "points_undo_own" ON "point_entries" FOR DELETE
	USING (awarded_by = auth.uid() AND has_permission('points.manage') AND created_at > now() - interval '10 minutes');--> statement-breakpoint
INSERT INTO "point_presets" ("label", "points", "category", "sort_order") VALUES
	('Attended a workshop', 5, 'event', 1),
	('Attended an event', 5, 'event', 2),
	('Helped organise', 10, 'contribution', 3),
	('Finished a project', 20, 'contribution', 4),
	('Late', -2, 'penalty', 5),
	('Absent without notice', -5, 'penalty', 6);
