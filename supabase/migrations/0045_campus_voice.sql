CREATE TABLE "campus_problems" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "campus_problems_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"title_en" text NOT NULL,
	"title_ar" text,
	"title_fr" text,
	"description_en" text,
	"description_ar" text,
	"description_fr" text,
	"icon" text DEFAULT 'Lightbulb' NOT NULL,
	"poll_id" bigint,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "campus_voice_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"event_date" date,
	"start_time" text,
	"end_time" text,
	"place_en" text,
	"place_ar" text,
	"place_fr" text,
	"show_on_home" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "campus_problems" ADD CONSTRAINT "campus_problems_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Exactly one settings row.
ALTER TABLE "campus_voice_settings" ADD CONSTRAINT "campus_voice_settings_single_row" CHECK ("id" = 1);--> statement-breakpoint
INSERT INTO "campus_voice_settings" ("id", "event_date", "start_time", "end_time", "place_en", "place_ar", "place_fr")
VALUES (1, '2026-11-18', '09:00', '12:00', 'University Incubator', 'حاضنة الجامعة', 'Incubateur universitaire')
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
-- Start from the problems planned for the incubator event.
INSERT INTO "campus_problems" ("title_en", "title_fr", "title_ar", "description_en", "description_fr", "description_ar", "icon", "sort_order") VALUES
	('Transportation', 'Transport', 'النقل',
	 'Late or crowded buses, long waits, and getting to campus on time.',
	 'Bus en retard ou bondés, longues attentes et arriver à l’heure à l’université.',
	 'تأخر الحافلات واكتظاظها، طول الانتظار، والوصول إلى الجامعة في الوقت.', 'Bus', 1),
	('Classroom availability', 'Disponibilité des salles', 'توفر القاعات',
	 'Finding a free room to study, work in a group or hold a club activity.',
	 'Trouver une salle libre pour réviser, travailler en groupe ou organiser une activité.',
	 'إيجاد قاعة شاغرة للمراجعة أو العمل الجماعي أو نشاط النادي.', 'DoorOpen', 2),
	('Internet access', 'Accès à Internet', 'الإنترنت',
	 'Wi-Fi coverage and speed on campus and in the residences.',
	 'Couverture et débit du Wi-Fi sur le campus et dans les résidences.',
	 'تغطية وسرعة شبكة Wi-Fi في الجامعة والإقامات.', 'Wifi', 3),
	('Study spaces & library', 'Espaces d’étude et bibliothèque', 'أماكن الدراسة والمكتبة',
	 'Quiet places to work, library hours, seats and access to books.',
	 'Endroits calmes pour travailler, horaires, places et accès aux livres.',
	 'أماكن هادئة للعمل، مواعيد المكتبة، المقاعد والوصول إلى الكتب.', 'BookOpen', 4),
	('University restaurant', 'Restaurant universitaire', 'المطعم الجامعي',
	 'Queues, meal quality, opening hours and places to eat.',
	 'Files d’attente, qualité des repas, horaires et espaces pour manger.',
	 'الطوابير، جودة الوجبات، أوقات العمل وأماكن الأكل.', 'UtensilsCrossed', 5);--> statement-breakpoint
-- The roles that manage polls manage this page; custom roles get in through
-- polls.manage, and has_role() already lets owner and super admin in.
-- Visitors read it through campus_voice_public() below.
ALTER TABLE "campus_voice_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "campus_problems" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "admin_all_campus_voice_settings" ON "campus_voice_settings";--> statement-breakpoint
CREATE POLICY "admin_all_campus_voice_settings" ON "campus_voice_settings" FOR ALL
	USING (has_role('event_manager') OR has_role('media_manager') OR has_permission('polls.manage'))
	WITH CHECK (has_role('event_manager') OR has_role('media_manager') OR has_permission('polls.manage'));--> statement-breakpoint
DROP POLICY IF EXISTS "admin_all_campus_problems" ON "campus_problems";--> statement-breakpoint
CREATE POLICY "admin_all_campus_problems" ON "campus_problems" FOR ALL
	USING (has_role('event_manager') OR has_role('media_manager') OR has_permission('polls.manage'))
	WITH CHECK (has_role('event_manager') OR has_role('media_manager') OR has_permission('polls.manage'));--> statement-breakpoint
-- The public page's data in one call. Polls stay private to admins, so this
-- exposes only the slug, and only of polls that are not drafts.
CREATE OR REPLACE FUNCTION public.campus_voice_public()
RETURNS jsonb AS $$
	SELECT jsonb_build_object(
		'settings', (SELECT to_jsonb(s) - 'updated_at' FROM campus_voice_settings s WHERE s.id = 1),
		'problems', COALESCE((
			SELECT jsonb_agg(jsonb_build_object(
				'id', p.id,
				'title_en', p.title_en, 'title_ar', p.title_ar, 'title_fr', p.title_fr,
				'description_en', p.description_en, 'description_ar', p.description_ar, 'description_fr', p.description_fr,
				'icon', p.icon,
				'poll_slug', CASE WHEN pl.status <> 'draft' THEN pl.slug END
			) ORDER BY p.sort_order, p.id)
			FROM campus_problems p
			LEFT JOIN polls pl ON pl.id = p.poll_id
			WHERE p.is_active
		), '[]'::jsonb)
	);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.campus_voice_public() TO anon, authenticated;
