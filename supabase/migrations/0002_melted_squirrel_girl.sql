CREATE TABLE "club_info" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "club_info_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"key" text NOT NULL,
	"label_en" text NOT NULL,
	"label_ar" text,
	"label_fr" text,
	"value_en" text NOT NULL,
	"value_ar" text,
	"value_fr" text,
	"category" text,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "club_info_key_unique" UNIQUE("key")
);
