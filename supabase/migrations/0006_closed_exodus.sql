ALTER TABLE "membership_applications" ADD COLUMN "member_code" text;--> statement-breakpoint
ALTER TABLE "membership_applications" ADD COLUMN "photo_url" text;--> statement-breakpoint
ALTER TABLE "membership_applications" ADD COLUMN "card_qr_code" text;--> statement-breakpoint
ALTER TABLE "membership_applications" ADD COLUMN "card_issued_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "membership_applications" ADD COLUMN "card_status" text DEFAULT 'none';--> statement-breakpoint
ALTER TABLE "membership_applications" ADD CONSTRAINT "membership_applications_member_code_unique" UNIQUE("member_code");