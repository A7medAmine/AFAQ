ALTER TABLE "need_items" ADD COLUMN "assignee_user_id" uuid;--> statement-breakpoint
ALTER TABLE "need_items" ADD COLUMN "assignee_member_id" bigint;--> statement-breakpoint
ALTER TABLE "need_items" ADD COLUMN "supplier" text;--> statement-breakpoint
ALTER TABLE "need_items" ADD COLUMN "stocked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "need_items" ADD COLUMN "borrow_batch_id" uuid;--> statement-breakpoint
ALTER TABLE "need_lists" ADD COLUMN "is_template" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "need_lists" ADD COLUMN "share_token" uuid;--> statement-breakpoint
ALTER TABLE "need_items" ADD CONSTRAINT "need_items_assignee_member_id_members_id_fk" FOREIGN KEY ("assignee_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "need_lists" ADD CONSTRAINT "need_lists_share_token_unique" UNIQUE("share_token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "need_items_assignee_user_id_idx" ON "need_items" ("assignee_user_id");--> statement-breakpoint
-- An item's history on its list page. Super admins already read the whole
-- log; anyone working the lists may read the entries about lists and items.
DROP POLICY IF EXISTS "admins read needs activity" ON "activity_logs";--> statement-breakpoint
CREATE POLICY "admins read needs activity" ON "activity_logs"
	FOR SELECT TO authenticated
	USING (
		"entity_type" IN ('need_items', 'need_lists')
		AND EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true)
	);--> statement-breakpoint
-- Names of the active admins, for assigning items and showing who changed
-- what. admin_users itself stays hidden from everyone but super admins.
CREATE OR REPLACE FUNCTION public.admin_directory()
RETURNS TABLE (user_id uuid, full_name text, email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
	SELECT au.user_id, au.full_name, au.email
	FROM admin_users au
	WHERE au.is_active = true
		AND EXISTS (SELECT 1 FROM admin_users me WHERE me.user_id = auth.uid() AND me.is_active = true)
	ORDER BY au.full_name
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.admin_directory() FROM public, anon;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.admin_directory() TO authenticated;
