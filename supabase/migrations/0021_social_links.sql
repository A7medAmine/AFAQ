CREATE TABLE "social_links" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "social_links_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"label" text NOT NULL,
	"url" text NOT NULL,
	"platform" text DEFAULT 'website' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
-- Start from the accounts the footer already links to.
INSERT INTO "social_links" ("label", "url", "platform", "sort_order") VALUES
	('Instagram', 'https://www.instagram.com/afaq_scientific_club/', 'instagram', 1),
	('Facebook', 'https://www.facebook.com/profile.php?id=61568388817184', 'facebook', 2),
	('TikTok', 'https://www.tiktok.com/@afaq.club', 'tiktok', 3),
	('Website', 'https://afaq.ahmedabd.me', 'website', 4),
	('Email', 'mailto:afaqclub.bouira@gmail.com', 'email', 5);--> statement-breakpoint
-- Anyone may read the links that are switched on; any active admin manages them.
ALTER TABLE "social_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "public_select_active_social_links" ON "social_links";--> statement-breakpoint
CREATE POLICY "public_select_active_social_links" ON "social_links"
	FOR SELECT USING ("is_active" = true);--> statement-breakpoint
DROP POLICY IF EXISTS "admin_all_social_links" ON "social_links";--> statement-breakpoint
CREATE POLICY "admin_all_social_links" ON "social_links"
	FOR ALL USING (EXISTS (
		SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true
	));
