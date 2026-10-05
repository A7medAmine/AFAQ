CREATE TABLE "shelves" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "shelves_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"code" text,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "shelves_code_unique" UNIQUE("code"),
	CONSTRAINT "shelves_name_unique" UNIQUE("name")
);
--> statement-breakpoint
-- Every place items are already kept becomes a shelf, so the add-item
-- dropdown starts out with them. Codes follow the row id like asset codes.
INSERT INTO "shelves" ("name")
	SELECT DISTINCT btrim("location") FROM "inventory_items"
	WHERE "location" IS NOT NULL AND btrim("location") <> ''
	ON CONFLICT ("name") DO NOTHING;--> statement-breakpoint
UPDATE "shelves" SET "code" = 'SHF-' || lpad("id"::text, 3, '0') WHERE "code" IS NULL;--> statement-breakpoint
-- Same access as inventory_items: any active admin.
ALTER TABLE "shelves" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "admin_all_shelves" ON "shelves";--> statement-breakpoint
CREATE POLICY "admin_all_shelves" ON "shelves"
	FOR ALL USING (EXISTS (
		SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true
	));
