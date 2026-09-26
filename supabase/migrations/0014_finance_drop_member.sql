ALTER TABLE "finance_transactions" DROP CONSTRAINT "finance_transactions_member_id_members_id_fk";
--> statement-breakpoint
ALTER TABLE "finance_transactions" DROP COLUMN "member_id";