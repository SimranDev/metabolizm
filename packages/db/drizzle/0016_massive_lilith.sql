CREATE TABLE "water_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"entry_date" date NOT NULL,
	"volume_ml" integer NOT NULL,
	"logged_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "water_entries_volume_ml_check" CHECK (volume_ml > 0 AND volume_ml <= 5000)
);
--> statement-breakpoint
CREATE TABLE "water_goals" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"daily_goal_ml" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "water_goals_daily_goal_ml_check" CHECK (daily_goal_ml >= 500 AND daily_goal_ml <= 10000)
);
--> statement-breakpoint
ALTER TABLE "water_entries" ADD CONSTRAINT "water_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "water_goals" ADD CONSTRAINT "water_goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "water_entries_user_date_idx" ON "water_entries" USING btree ("user_id","entry_date","logged_at") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "water_entries_user_updated_idx" ON "water_entries" USING btree ("user_id","updated_at","id");