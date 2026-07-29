ALTER TABLE "attendance_records" ADD COLUMN "kind" varchar(10) DEFAULT 'shift' NOT NULL;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "overtime_status" varchar(10);--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "reviewed_by" text;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "review_note" text;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;