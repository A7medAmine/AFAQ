ALTER TABLE "review_settings" ADD COLUMN "applications_open" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "review_settings" ADD COLUMN "applications_closed_note" text;