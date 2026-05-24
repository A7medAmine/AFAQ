CREATE TABLE "faq" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "faq_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"question_en" text,
	"question_ar" text,
	"question_fr" text,
	"answer_en" text,
	"answer_ar" text,
	"answer_fr" text,
	"category" text,
	"is_published" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
