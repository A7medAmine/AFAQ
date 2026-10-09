CREATE TABLE "poll_answers" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "poll_answers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"response_id" bigint NOT NULL,
	"poll_id" bigint NOT NULL,
	"question_id" bigint NOT NULL,
	"option_id" bigint,
	"number_value" integer,
	"text_value" text
);
--> statement-breakpoint
CREATE TABLE "poll_options" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "poll_options_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"question_id" bigint NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"label" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "poll_questions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "poll_questions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"poll_id" bigint NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"type" text DEFAULT 'single' NOT NULL,
	"prompt" text NOT NULL,
	"help" text,
	"required" boolean DEFAULT true NOT NULL,
	"min_choices" integer,
	"max_choices" integer,
	"scale_max" integer
);
--> statement-breakpoint
CREATE TABLE "poll_responses" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "poll_responses_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"poll_id" bigint NOT NULL,
	"voter_key" text NOT NULL,
	"member_id" bigint,
	"name" text,
	"email" text,
	"ip_hash" text,
	"source" text,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "poll_responses_poll_voter_unique" UNIQUE("poll_id","voter_key")
);
--> statement-breakpoint
CREATE TABLE "polls" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "polls_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"language" text DEFAULT 'en' NOT NULL,
	"audience" text DEFAULT 'public' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"opens_at" timestamp with time zone,
	"closes_at" timestamp with time zone,
	"results_visibility" text DEFAULT 'after_vote' NOT NULL,
	"collect_identity" text DEFAULT 'none' NOT NULL,
	"max_responses" integer,
	"thank_you_message" text,
	"event_id" bigint,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "polls_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "poll_answers" ADD CONSTRAINT "poll_answers_response_id_poll_responses_id_fk" FOREIGN KEY ("response_id") REFERENCES "public"."poll_responses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_answers" ADD CONSTRAINT "poll_answers_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_answers" ADD CONSTRAINT "poll_answers_question_id_poll_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."poll_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_answers" ADD CONSTRAINT "poll_answers_option_id_poll_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."poll_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_options" ADD CONSTRAINT "poll_options_question_id_poll_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."poll_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_questions" ADD CONSTRAINT "poll_questions_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_responses" ADD CONSTRAINT "poll_responses_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_responses" ADD CONSTRAINT "poll_responses_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polls" ADD CONSTRAINT "polls_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "poll_answers_poll_id_idx" ON "poll_answers" USING btree ("poll_id");--> statement-breakpoint
CREATE INDEX "poll_options_question_id_idx" ON "poll_options" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "poll_questions_poll_id_idx" ON "poll_questions" USING btree ("poll_id");--> statement-breakpoint
CREATE INDEX "poll_responses_poll_id_idx" ON "poll_responses" USING btree ("poll_id");--> statement-breakpoint
ALTER TABLE "polls" ADD CONSTRAINT "polls_status_check" CHECK ("status" IN ('draft', 'open', 'closed'));--> statement-breakpoint
ALTER TABLE "polls" ADD CONSTRAINT "polls_language_check" CHECK ("language" IN ('en', 'fr', 'ar'));--> statement-breakpoint
ALTER TABLE "polls" ADD CONSTRAINT "polls_audience_check" CHECK ("audience" IN ('public', 'members'));--> statement-breakpoint
ALTER TABLE "polls" ADD CONSTRAINT "polls_results_visibility_check" CHECK ("results_visibility" IN ('hidden', 'after_vote', 'after_close'));--> statement-breakpoint
ALTER TABLE "polls" ADD CONSTRAINT "polls_collect_identity_check" CHECK ("collect_identity" IN ('none', 'optional', 'required'));--> statement-breakpoint
ALTER TABLE "polls" ADD CONSTRAINT "polls_max_responses_positive" CHECK ("max_responses" IS NULL OR "max_responses" > 0);--> statement-breakpoint
ALTER TABLE "polls" ADD CONSTRAINT "polls_slug_format" CHECK ("slug" ~ '^[A-Za-z0-9_-]{4,64}$');--> statement-breakpoint
ALTER TABLE "poll_questions" ADD CONSTRAINT "poll_questions_type_check" CHECK ("type" IN ('single', 'multiple', 'rating', 'text'));--> statement-breakpoint
ALTER TABLE "poll_questions" ADD CONSTRAINT "poll_questions_scale_check" CHECK ("scale_max" IS NULL OR "scale_max" BETWEEN 2 AND 10);--> statement-breakpoint
-- Polls are managed by any active admin, like needs lists. Nobody else reads
-- the tables: the public page goes through the API with the service key.
ALTER TABLE "polls" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "poll_questions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "poll_options" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "poll_responses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "poll_answers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "admin_all_polls" ON "polls";--> statement-breakpoint
CREATE POLICY "admin_all_polls" ON "polls"
	FOR ALL USING (EXISTS (
		SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true
	));--> statement-breakpoint
DROP POLICY IF EXISTS "admin_all_poll_questions" ON "poll_questions";--> statement-breakpoint
CREATE POLICY "admin_all_poll_questions" ON "poll_questions"
	FOR ALL USING (EXISTS (
		SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true
	));--> statement-breakpoint
DROP POLICY IF EXISTS "admin_all_poll_options" ON "poll_options";--> statement-breakpoint
CREATE POLICY "admin_all_poll_options" ON "poll_options"
	FOR ALL USING (EXISTS (
		SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true
	));--> statement-breakpoint
-- Admins read and clear responses; only the API's vote function adds them.
DROP POLICY IF EXISTS "admin_read_poll_responses" ON "poll_responses";--> statement-breakpoint
CREATE POLICY "admin_read_poll_responses" ON "poll_responses"
	FOR SELECT USING (EXISTS (
		SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true
	));--> statement-breakpoint
DROP POLICY IF EXISTS "admin_delete_poll_responses" ON "poll_responses";--> statement-breakpoint
CREATE POLICY "admin_delete_poll_responses" ON "poll_responses"
	FOR DELETE USING (EXISTS (
		SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true
	));--> statement-breakpoint
DROP POLICY IF EXISTS "admin_read_poll_answers" ON "poll_answers";--> statement-breakpoint
CREATE POLICY "admin_read_poll_answers" ON "poll_answers"
	FOR SELECT USING (EXISTS (
		SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true
	));--> statement-breakpoint
-- Swap a poll's questions for a new set in one go. Refused once anyone has
-- answered, since their answers point at the old questions and options.
-- Runs as the caller, so the admin policies above still apply.
CREATE OR REPLACE FUNCTION public.poll_replace_questions(p_poll_id bigint, p_questions jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
	q jsonb;
	q_id bigint;
	opt text;
	q_pos integer := 0;
	o_pos integer;
BEGIN
	IF NOT EXISTS (SELECT 1 FROM polls WHERE id = p_poll_id) THEN
		RAISE EXCEPTION 'That poll does not exist.' USING ERRCODE = 'P0002';
	END IF;
	IF EXISTS (SELECT 1 FROM poll_responses WHERE poll_id = p_poll_id) THEN
		RAISE EXCEPTION 'This poll already has answers. Clear them before changing the questions.' USING ERRCODE = 'P0001';
	END IF;
	DELETE FROM poll_questions WHERE poll_id = p_poll_id;
	FOR q IN SELECT * FROM jsonb_array_elements(coalesce(p_questions, '[]'::jsonb)) LOOP
		INSERT INTO poll_questions (poll_id, position, type, prompt, help, required, min_choices, max_choices, scale_max)
		VALUES (
			p_poll_id, q_pos, q->>'type', q->>'prompt', nullif(q->>'help', ''),
			coalesce((q->>'required')::boolean, true),
			(q->>'min_choices')::integer, (q->>'max_choices')::integer, (q->>'scale_max')::integer
		)
		RETURNING id INTO q_id;
		o_pos := 0;
		FOR opt IN SELECT * FROM jsonb_array_elements_text(coalesce(q->'options', '[]'::jsonb)) LOOP
			INSERT INTO poll_options (question_id, position, label) VALUES (q_id, o_pos, opt);
			o_pos := o_pos + 1;
		END LOOP;
		q_pos := q_pos + 1;
	END LOOP;
	UPDATE polls SET updated_at = now() WHERE id = p_poll_id;
END
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.poll_replace_questions(bigint, jsonb) FROM public, anon;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.poll_replace_questions(bigint, jsonb) TO authenticated;--> statement-breakpoint
-- Record one response and its answers together. The API validates the
-- answers first; this holds the poll row while counting so two last votes
-- can't both squeeze under max_responses. A second vote with the same
-- voter_key fails on the unique constraint (23505).
CREATE OR REPLACE FUNCTION public.poll_submit_response(
	p_poll_id bigint, p_voter_key text, p_member_id bigint, p_name text, p_email text,
	p_ip_hash text, p_source text, p_answers jsonb
)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
	v_poll polls%ROWTYPE;
	v_count integer;
	v_response_id bigint;
BEGIN
	SELECT * INTO v_poll FROM polls WHERE id = p_poll_id FOR UPDATE;
	IF NOT FOUND THEN RAISE EXCEPTION 'poll_not_found' USING ERRCODE = 'P0002'; END IF;
	IF v_poll.status <> 'open'
		OR (v_poll.opens_at IS NOT NULL AND v_poll.opens_at > now())
		OR (v_poll.closes_at IS NOT NULL AND v_poll.closes_at <= now()) THEN
		RAISE EXCEPTION 'poll_closed' USING ERRCODE = 'P0001';
	END IF;
	IF v_poll.max_responses IS NOT NULL THEN
		SELECT count(*) INTO v_count FROM poll_responses WHERE poll_id = p_poll_id;
		IF v_count >= v_poll.max_responses THEN RAISE EXCEPTION 'poll_full' USING ERRCODE = 'P0001'; END IF;
	END IF;
	INSERT INTO poll_responses (poll_id, voter_key, member_id, name, email, ip_hash, source)
	VALUES (p_poll_id, p_voter_key, p_member_id, p_name, p_email, p_ip_hash, p_source)
	RETURNING id INTO v_response_id;
	INSERT INTO poll_answers (response_id, poll_id, question_id, option_id, number_value, text_value)
	SELECT v_response_id, p_poll_id, (a->>'question_id')::bigint, (a->>'option_id')::bigint,
		(a->>'number_value')::integer, a->>'text_value'
	FROM jsonb_array_elements(coalesce(p_answers, '[]'::jsonb)) a;
	RETURN v_response_id;
END
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.poll_submit_response(bigint, text, bigint, text, text, text, text, jsonb) FROM public, anon, authenticated;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.poll_submit_response(bigint, text, bigint, text, text, text, text, jsonb) TO service_role;