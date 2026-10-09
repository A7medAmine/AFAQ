ALTER TABLE "admin_users" ADD COLUMN "member_id" bigint;--> statement-breakpoint
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_member_id_unique" UNIQUE("member_id");