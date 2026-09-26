CREATE TABLE "finance_budgets" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "finance_budgets_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"event_id" bigint,
	"project_id" bigint,
	"planned_income" numeric(12, 2) DEFAULT '0' NOT NULL,
	"planned_expense" numeric(12, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "finance_transactions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "finance_transactions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"kind" text NOT NULL,
	"category" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"occurred_on" date DEFAULT now() NOT NULL,
	"description" text,
	"counterparty" text,
	"payment_method" text,
	"reference" text,
	"receipt_url" text,
	"member_id" bigint,
	"event_id" bigint,
	"project_id" bigint,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "finance_budgets" ADD CONSTRAINT "finance_budgets_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_budgets" ADD CONSTRAINT "finance_budgets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Budgets hang off one event, one project, or neither (a club-wide budget).
ALTER TABLE "finance_budgets" ADD CONSTRAINT "finance_budgets_single_scope" CHECK (NOT ("event_id" IS NOT NULL AND "project_id" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_kind_check" CHECK ("kind" IN ('income', 'expense'));--> statement-breakpoint
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_amount_positive" CHECK ("amount" > 0);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "finance_transactions_occurred_on_idx" ON "finance_transactions" ("occurred_on");--> statement-breakpoint
-- The treasurer keeps the books without getting the rest of the console.
INSERT INTO "admin_roles" ("name", "label", "description") VALUES
	('treasurer', 'Treasurer', 'Manage income, expenses and budgets')
ON CONFLICT ("name") DO NOTHING;--> statement-breakpoint
-- RLS: money is visible to the treasurer and super admins only
-- (has_role() already lets super_admin through).
ALTER TABLE "finance_transactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "finance_budgets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "admin_all_finance_transactions" ON "finance_transactions";--> statement-breakpoint
CREATE POLICY "admin_all_finance_transactions" ON "finance_transactions"
	FOR ALL USING (has_role('treasurer'));--> statement-breakpoint
DROP POLICY IF EXISTS "admin_all_finance_budgets" ON "finance_budgets";--> statement-breakpoint
CREATE POLICY "admin_all_finance_budgets" ON "finance_budgets"
	FOR ALL USING (has_role('treasurer'));
