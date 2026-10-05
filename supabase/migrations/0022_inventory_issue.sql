-- Two kinds of check-out: a loan comes back, an issue is handed out for good
-- (a part used in a build). Issues take units off the count, so an item can
-- now reach 0 — status 'out_of_stock' then, until it's restocked.
ALTER TABLE "borrow_records" ADD COLUMN "kind" text DEFAULT 'loan' NOT NULL;--> statement-breakpoint
ALTER TABLE "borrow_records" ADD COLUMN "purpose" text;--> statement-breakpoint
ALTER TABLE "borrow_records" ADD COLUMN "consumed_quantity" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD COLUMN "tracking_mode" text DEFAULT 'returnable' NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD COLUMN "min_stock" integer;--> statement-breakpoint
UPDATE "inventory_items" SET "tracking_mode" = 'consumable' WHERE "category" = 'Consumables';--> statement-breakpoint
ALTER TABLE "inventory_items" DROP CONSTRAINT "inventory_items_quantity_check";--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_quantity_check" CHECK ("quantity" >= 0 AND "on_loan" >= 0 AND "on_loan" <= "quantity");--> statement-breakpoint
-- Hand out units for good. Like inventory_lend, it checks enough are on the
-- shelf in the same step, so two screens can't hand out the same last unit.
CREATE OR REPLACE FUNCTION public.inventory_issue(p_item bigint, p_qty integer)
RETURNS boolean LANGUAGE sql AS $$
	WITH u AS (
		UPDATE "inventory_items"
		SET "quantity" = "quantity" - p_qty,
			"status" = CASE
				WHEN "quantity" - p_qty = 0 THEN 'out_of_stock'
				WHEN "on_loan" >= "quantity" - p_qty THEN 'borrowed'
				ELSE 'available' END,
			"updated_at" = now()
		WHERE "id" = p_item AND "status" = 'available' AND p_qty >= 1 AND "quantity" - "on_loan" >= p_qty
		RETURNING 1
	)
	SELECT EXISTS (SELECT 1 FROM u)
$$;--> statement-breakpoint
-- Close a loan: p_returned units go back on the shelf, p_used were used up
-- and leave the count. Repair / retired keep their status.
CREATE OR REPLACE FUNCTION public.inventory_settle(p_item bigint, p_returned integer, p_used integer)
RETURNS void LANGUAGE sql AS $$
	UPDATE "inventory_items"
	SET "on_loan" = greatest("on_loan" - p_returned - p_used, 0),
		"quantity" = greatest("quantity" - p_used, 0),
		"status" = CASE
			WHEN "status" NOT IN ('available', 'borrowed', 'out_of_stock') THEN "status"
			WHEN "quantity" - p_used <= 0 THEN 'out_of_stock'
			WHEN greatest("on_loan" - p_returned - p_used, 0) >= "quantity" - p_used THEN 'borrowed'
			ELSE 'available' END,
		"updated_at" = now()
	WHERE "id" = p_item AND p_returned >= 0 AND p_used >= 0
$$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.inventory_restock(p_item bigint, p_qty integer)
RETURNS integer LANGUAGE sql AS $$
	UPDATE "inventory_items"
	SET "quantity" = "quantity" + p_qty,
		"status" = CASE WHEN "status" IN ('borrowed', 'out_of_stock') THEN 'available' ELSE "status" END,
		"updated_at" = now()
	WHERE "id" = p_item AND p_qty >= 1
	RETURNING "quantity"
$$;
