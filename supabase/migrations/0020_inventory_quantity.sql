-- One row per kind of item with a count, instead of one row per physical unit.
-- on_loan counts units out on active loans; status 'borrowed' now means every
-- unit is out, so the existing filters and badges keep their meaning.
ALTER TABLE "inventory_items" ADD COLUMN "quantity" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD COLUMN "on_loan" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "borrow_records" ADD COLUMN "quantity" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_quantity_check" CHECK ("quantity" >= 1 AND "on_loan" >= 0 AND "on_loan" <= "quantity");--> statement-breakpoint
UPDATE "inventory_items" SET "on_loan" = 1 WHERE "status" = 'borrowed';--> statement-breakpoint
-- Fold the per-unit copies made so far into one row each: same name, shelf,
-- category and condition, available and never lent. The lowest id (and its
-- asset code / QR label) is kept; the other copies' labels stop scanning.
WITH grouped AS (
	SELECT "id",
		min("id") OVER w AS keep_id,
		count(*) OVER w AS n
	FROM "inventory_items" i
	WHERE "status" = 'available'
		AND NOT EXISTS (SELECT 1 FROM "borrow_records" b WHERE b."item_id" = i."id")
	WINDOW w AS (PARTITION BY lower(btrim("name")), coalesce(btrim("location"), ''), coalesce("category", ''), coalesce("condition", ''))
),
counted AS (
	UPDATE "inventory_items" t SET "quantity" = g.n
	FROM grouped g WHERE t."id" = g."id" AND g."id" = g.keep_id AND g.n > 1
	RETURNING t."id"
)
DELETE FROM "inventory_items" d
USING grouped g WHERE d."id" = g."id" AND g."id" <> g.keep_id;--> statement-breakpoint
-- Lending and returning change counts atomically, so two screens can't lend
-- the same last unit. They run as the caller, so the table's RLS still applies.
CREATE OR REPLACE FUNCTION public.inventory_lend(p_item bigint, p_qty integer)
RETURNS boolean LANGUAGE sql AS $$
	WITH u AS (
		UPDATE "inventory_items"
		SET "on_loan" = "on_loan" + p_qty,
			"status" = CASE WHEN "on_loan" + p_qty >= "quantity" THEN 'borrowed' ELSE 'available' END,
			"updated_at" = now()
		WHERE "id" = p_item AND "status" = 'available' AND p_qty >= 1 AND "on_loan" + p_qty <= "quantity"
		RETURNING 1
	)
	SELECT EXISTS (SELECT 1 FROM u)
$$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.inventory_release(p_item bigint, p_qty integer)
RETURNS void LANGUAGE sql AS $$
	UPDATE "inventory_items"
	SET "on_loan" = greatest("on_loan" - p_qty, 0),
		"status" = CASE WHEN "status" = 'borrowed' THEN 'available' ELSE "status" END,
		"updated_at" = now()
	WHERE "id" = p_item
$$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.inventory_restock(p_item bigint, p_qty integer)
RETURNS integer LANGUAGE sql AS $$
	UPDATE "inventory_items"
	SET "quantity" = "quantity" + p_qty,
		"status" = CASE WHEN "status" = 'borrowed' THEN 'available' ELSE "status" END,
		"updated_at" = now()
	WHERE "id" = p_item AND p_qty >= 1
	RETURNING "quantity"
$$;
