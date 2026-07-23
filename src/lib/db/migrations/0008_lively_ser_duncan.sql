CREATE TABLE "piket_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" varchar(10) NOT NULL,
	"user_id" text NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"done_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "piket_assignments" ADD CONSTRAINT "piket_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "piket_assignments_date_idx" ON "piket_assignments" USING btree ("date");