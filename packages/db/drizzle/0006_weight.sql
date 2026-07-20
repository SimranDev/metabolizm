CREATE TYPE "public"."weight_unit" AS ENUM('kg', 'lb', 'st');--> statement-breakpoint
CREATE TABLE "user_weight_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"effective_from" date NOT NULL,
	"target_weight_kg" numeric(6, 2) NOT NULL,
	"starting_weight_kg" numeric(6, 2) NOT NULL,
	"target_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_weight_goals_weights_check" CHECK (target_weight_kg > 20 AND target_weight_kg < 500 AND starting_weight_kg > 20 AND starting_weight_kg < 500)
);
--> statement-breakpoint
CREATE TABLE "weight_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"entry_date" date NOT NULL,
	"weight_kg" numeric(6, 2) NOT NULL,
	"logged_at" timestamp with time zone DEFAULT now() NOT NULL,
	"note" text,
	"source" text DEFAULT 'manual' NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "weight_entries_weight_kg_check" CHECK (weight_kg > 20 AND weight_kg < 500)
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "weight_unit" "weight_unit" DEFAULT 'kg' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_weight_goals" ADD CONSTRAINT "user_weight_goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weight_entries" ADD CONSTRAINT "weight_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_weight_goals_user_effective_idx" ON "user_weight_goals" USING btree ("user_id","effective_from");--> statement-breakpoint
CREATE INDEX "weight_entries_user_date_idx" ON "weight_entries" USING btree ("user_id","entry_date","logged_at") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "weight_entries_user_updated_idx" ON "weight_entries" USING btree ("user_id","updated_at","id");