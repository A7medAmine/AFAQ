ALTER TABLE "member_roles" ADD COLUMN "builtin_key" text;--> statement-breakpoint
ALTER TABLE "member_roles" ADD CONSTRAINT "member_roles_builtin_key_unique" UNIQUE("builtin_key");