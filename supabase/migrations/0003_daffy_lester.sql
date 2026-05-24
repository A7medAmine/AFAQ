CREATE TABLE "ai_knowledge" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ai_knowledge_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"category" text,
	"content" text NOT NULL,
	"keywords" text[],
	"published" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "ai_knowledge_slug_unique" UNIQUE("slug")
);
