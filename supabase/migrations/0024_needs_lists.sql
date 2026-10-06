CREATE TABLE "departments" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "departments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"color" text,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "departments_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "need_items" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "need_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"list_id" bigint NOT NULL,
	"department_id" bigint,
	"kind" text DEFAULT 'equipment' NOT NULL,
	"name" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit" text,
	"inventory_item_id" bigint,
	"source" text DEFAULT 'buy' NOT NULL,
	"status" text DEFAULT 'needed' NOT NULL,
	"priority" text DEFAULT 'must' NOT NULL,
	"assignee" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "need_lists" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "need_lists_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"title" text NOT NULL,
	"scope" text DEFAULT 'custom' NOT NULL,
	"event_id" bigint,
	"department_id" bigint,
	"due_date" date,
	"status" text DEFAULT 'open' NOT NULL,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "admin_roles" ADD COLUMN "permissions" text[];--> statement-breakpoint
ALTER TABLE "need_items" ADD CONSTRAINT "need_items_list_id_need_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."need_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "need_items" ADD CONSTRAINT "need_items_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "need_items" ADD CONSTRAINT "need_items_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "need_lists" ADD CONSTRAINT "need_lists_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "need_lists" ADD CONSTRAINT "need_lists_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "need_items_list_id_idx" ON "need_items" USING btree ("list_id");--> statement-breakpoint
ALTER TABLE "need_lists" ADD CONSTRAINT "need_lists_scope_check" CHECK ("scope" IN ('event', 'department', 'custom'));--> statement-breakpoint
ALTER TABLE "need_lists" ADD CONSTRAINT "need_lists_status_check" CHECK ("status" IN ('open', 'done', 'archived'));--> statement-breakpoint
ALTER TABLE "need_items" ADD CONSTRAINT "need_items_kind_check" CHECK ("kind" IN ('equipment', 'consumable', 'other'));--> statement-breakpoint
ALTER TABLE "need_items" ADD CONSTRAINT "need_items_source_check" CHECK ("source" IN ('stock', 'buy', 'borrow', 'make'));--> statement-breakpoint
ALTER TABLE "need_items" ADD CONSTRAINT "need_items_status_check" CHECK ("status" IN ('needed', 'ordered', 'ready', 'cancelled'));--> statement-breakpoint
ALTER TABLE "need_items" ADD CONSTRAINT "need_items_priority_check" CHECK ("priority" IN ('must', 'nice'));--> statement-breakpoint
ALTER TABLE "need_items" ADD CONSTRAINT "need_items_quantity_positive" CHECK ("quantity" > 0);--> statement-breakpoint
-- Starting departments; they are renamed, added to and removed in the console.
INSERT INTO "departments" ("name", "color", "sort_order") VALUES
	('Tech', '#2563eb', 1),
	('Media', '#db2777', 2),
	('Logistics', '#d97706', 3)
ON CONFLICT ("name") DO NOTHING;--> statement-breakpoint
-- A starting point for the logistics team; super admins change what it holds.
INSERT INTO "admin_roles" ("name", "label", "description", "permissions") VALUES
	('logistics', 'Logistics', 'Needs lists, inventory and borrowing', ARRAY['needs.manage', 'inventory.manage', 'messages.view'])
ON CONFLICT ("name") DO NOTHING;--> statement-breakpoint
-- Super admins create and edit roles; everyone else only reads them.
DROP POLICY IF EXISTS "super_admin_write_admin_roles" ON "admin_roles";--> statement-breakpoint
CREATE POLICY "super_admin_write_admin_roles" ON "admin_roles"
	FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());--> statement-breakpoint
-- Same access as inventory: any active admin.
ALTER TABLE "departments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "need_lists" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "need_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "admin_all_departments" ON "departments";--> statement-breakpoint
CREATE POLICY "admin_all_departments" ON "departments"
	FOR ALL USING (EXISTS (
		SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true
	));--> statement-breakpoint
DROP POLICY IF EXISTS "admin_all_need_lists" ON "need_lists";--> statement-breakpoint
CREATE POLICY "admin_all_need_lists" ON "need_lists"
	FOR ALL USING (EXISTS (
		SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true
	));--> statement-breakpoint
DROP POLICY IF EXISTS "admin_all_need_items" ON "need_items";--> statement-breakpoint
CREATE POLICY "admin_all_need_items" ON "need_items"
	FOR ALL USING (EXISTS (
		SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true
	));
