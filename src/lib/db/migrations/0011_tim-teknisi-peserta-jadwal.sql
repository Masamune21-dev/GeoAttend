CREATE TABLE "schedule_participants" (
	"user_id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "technician_team" varchar(10);--> statement-breakpoint
ALTER TABLE "schedule_participants" ADD CONSTRAINT "schedule_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;