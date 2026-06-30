CREATE TABLE "page_content" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "page_content_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"section" text NOT NULL,
	"image_url" text,
	"alt_text" text,
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "page_content_section_unique" UNIQUE("section")
);
