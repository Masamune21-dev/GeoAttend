CREATE TABLE "schedule_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"date" varchar(10) NOT NULL,
	"shift" varchar(10) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shift_swap_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_id" text NOT NULL,
	"target_id" text NOT NULL,
	"date" varchar(10) NOT NULL,
	"requester_shift" varchar(10) NOT NULL,
	"target_shift" varchar(10) NOT NULL,
	"status" varchar(20) DEFAULT 'pending_peer' NOT NULL,
	"reason" text,
	"peer_responded_at" timestamp,
	"reviewed_by" text,
	"reviewed_at" timestamp,
	"review_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "schedule_entries" ADD CONSTRAINT "schedule_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_swap_requests" ADD CONSTRAINT "shift_swap_requests_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_swap_requests" ADD CONSTRAINT "shift_swap_requests_target_id_users_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_swap_requests" ADD CONSTRAINT "shift_swap_requests_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "schedule_entries_user_date_idx" ON "schedule_entries" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "schedule_entries_date_idx" ON "schedule_entries" USING btree ("date");--> statement-breakpoint
CREATE INDEX "shift_swap_target_status_idx" ON "shift_swap_requests" USING btree ("target_id","status");--> statement-breakpoint
CREATE INDEX "shift_swap_requester_idx" ON "shift_swap_requests" USING btree ("requester_id");--> statement-breakpoint
CREATE INDEX "shift_swap_date_idx" ON "shift_swap_requests" USING btree ("date");