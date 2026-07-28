CREATE TABLE "location_trails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"recorded_at" timestamp NOT NULL,
	"latitude" numeric(10, 7) NOT NULL,
	"longitude" numeric(10, 7) NOT NULL,
	"accuracy_meters" numeric(6, 2),
	"is_mocked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "location_trails" ADD CONSTRAINT "location_trails_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "location_trails_user_recorded_idx" ON "location_trails" USING btree ("user_id","recorded_at");--> statement-breakpoint
CREATE INDEX "location_trails_recorded_idx" ON "location_trails" USING btree ("recorded_at");