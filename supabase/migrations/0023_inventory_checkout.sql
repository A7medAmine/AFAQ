ALTER TABLE "borrow_records" ADD COLUMN "batch_id" uuid;--> statement-breakpoint
-- Check out a whole basket in one step: every line is lent or handed out and
-- recorded, or none is. A line that can't be filled raises
-- 'not_enough:<item id>' so the counter can point at it. Runs as the caller,
-- so the tables' RLS still applies.
CREATE OR REPLACE FUNCTION public.inventory_checkout(
	p_lines jsonb,
	p_member bigint,
	p_borrower text,
	p_purpose text,
	p_due timestamptz,
	p_note text
)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
	v_batch uuid := gen_random_uuid();
	v_line jsonb;
	v_item bigint;
	v_qty integer;
	v_kind text;
	v_ok boolean;
BEGIN
	IF jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
		RAISE EXCEPTION 'empty_basket';
	END IF;
	FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
		v_item := (v_line->>'item_id')::bigint;
		v_qty := (v_line->>'quantity')::integer;
		v_kind := coalesce(v_line->>'kind', 'loan');
		IF v_kind NOT IN ('loan', 'issue') THEN
			RAISE EXCEPTION 'bad_kind:%', v_item;
		END IF;
		v_ok := CASE WHEN v_kind = 'issue'
			THEN public.inventory_issue(v_item, v_qty)
			ELSE public.inventory_lend(v_item, v_qty) END;
		IF NOT v_ok THEN
			RAISE EXCEPTION 'not_enough:%', v_item;
		END IF;
		INSERT INTO "borrow_records" (
			"item_id", "kind", "quantity", "consumed_quantity", "member_id", "borrower_name",
			"purpose", "expected_return_at", "condition_note_out", "status", "batch_id"
		) VALUES (
			v_item, v_kind, v_qty, CASE WHEN v_kind = 'issue' THEN v_qty ELSE 0 END, p_member, p_borrower,
			p_purpose, CASE WHEN v_kind = 'loan' THEN p_due END, p_note,
			CASE WHEN v_kind = 'issue' THEN 'consumed' ELSE 'active' END, v_batch
		);
	END LOOP;
	RETURN v_batch;
END
$$;
