CREATE TABLE "shift_reminders" (
	"user_id" text NOT NULL,
	"date" varchar(10) NOT NULL,
	"shift_number" integer NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "shift_reminders_user_id_date_shift_number_pk" PRIMARY KEY("user_id","date","shift_number")
);
--> statement-breakpoint
ALTER TABLE "shift_reminders" ADD CONSTRAINT "shift_reminders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shift_reminders_date_idx" ON "shift_reminders" USING btree ("date");