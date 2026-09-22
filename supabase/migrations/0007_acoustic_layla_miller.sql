CREATE TABLE "borrow_records" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "borrow_records_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"item_id" bigint NOT NULL,
	"member_id" bigint,
	"borrower_name" text,
	"checked_out_at" timestamp with time zone DEFAULT now(),
	"expected_return_at" timestamp with time zone,
	"returned_at" timestamp with time zone,
	"condition_note_out" text,
	"condition_note_in" text,
	"status" text DEFAULT 'active',
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "inventory_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"asset_code" text NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"serial" text,
	"condition" text DEFAULT 'good',
	"purchase_date" date,
	"value" integer,
	"location" text,
	"photo_url" text,
	"status" text DEFAULT 'available',
	"qr_code" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "inventory_items_asset_code_unique" UNIQUE("asset_code")
);
--> statement-breakpoint
ALTER TABLE "borrow_records" ADD CONSTRAINT "borrow_records_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "borrow_records" ADD CONSTRAINT "borrow_records_member_id_membership_applications_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."membership_applications"("id") ON DELETE set null ON UPDATE no action;