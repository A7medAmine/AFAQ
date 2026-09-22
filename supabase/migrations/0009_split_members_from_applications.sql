CREATE TABLE "members" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "members_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"application_id" bigint,
	"member_code" text,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"student_id" text,
	"department" text,
	"study_year" text,
	"skills" text[],
	"interests" text[],
	"photo_url" text,
	"card_qr_code" text,
	"card_issued_at" timestamp with time zone,
	"card_status" text DEFAULT 'none',
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "members_member_code_unique" UNIQUE("member_code")
);
--> statement-breakpoint
-- Backfill: every approved application becomes a member row, keeping the
-- application_id link so history and the roster stay traceable to each other.
INSERT INTO "members" (
	"application_id", "member_code", "full_name", "email", "phone", "student_id",
	"department", "study_year", "skills", "interests", "photo_url",
	"card_qr_code", "card_issued_at", "card_status", "created_at"
)
SELECT
	"id",
	COALESCE("member_code", 'AFQ-' || lpad("id"::text, 5, '0')),
	"full_name", "email", "phone", "student_id", "department", "study_year",
	"skills", "interests", "photo_url", "card_qr_code", "card_issued_at",
	COALESCE("card_status", 'none'), "created_at"
FROM "membership_applications"
WHERE "status" = 'approved';
--> statement-breakpoint
ALTER TABLE "membership_applications" DROP CONSTRAINT "membership_applications_member_code_unique";--> statement-breakpoint
ALTER TABLE "borrow_records" DROP CONSTRAINT "borrow_records_member_id_membership_applications_id_fk";
--> statement-breakpoint
-- Remap existing borrow records from the old application id to the new member id.
UPDATE "borrow_records" br
SET "member_id" = m."id"
FROM "members" m
WHERE m."application_id" = br."member_id";
--> statement-breakpoint
-- Anything left pointing at a stale application id (no corresponding member) is cleared
-- rather than left dangling, since the FK below will otherwise refuse to attach.
UPDATE "borrow_records" br
SET "member_id" = NULL
WHERE br."member_id" IS NOT NULL
	AND NOT EXISTS (SELECT 1 FROM "members" m2 WHERE m2."id" = br."member_id");
--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_application_id_membership_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."membership_applications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "borrow_records" ADD CONSTRAINT "borrow_records_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_applications" DROP COLUMN "member_code";--> statement-breakpoint
ALTER TABLE "membership_applications" DROP COLUMN "photo_url";--> statement-breakpoint
ALTER TABLE "membership_applications" DROP COLUMN "card_qr_code";--> statement-breakpoint
ALTER TABLE "membership_applications" DROP COLUMN "card_issued_at";--> statement-breakpoint
ALTER TABLE "membership_applications" DROP COLUMN "card_status";
