ALTER TABLE "shift_swap_requests" ADD COLUMN "kind" varchar(10) DEFAULT 'shift' NOT NULL;--> statement-breakpoint
ALTER TABLE "shift_swap_requests" ADD COLUMN "target_date" varchar(10);