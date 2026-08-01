CREATE TABLE "fasting_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"target_hours" integer NOT NULL,
	"protocol" text DEFAULT 'custom' NOT NULL,
	"note" text,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "fasting_sessions_target_hours_check" CHECK (target_hours >= 1 AND target_hours <= 72),
	CONSTRAINT "fasting_sessions_ended_after_started_check" CHECK (ended_at IS NULL OR ended_at > started_at)
);
--> statement-breakpoint
ALTER TABLE "fasting_sessions" ADD CONSTRAINT "fasting_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fasting_sessions_user_started_idx" ON "fasting_sessions" USING btree ("user_id","started_at") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "fasting_sessions_user_open_uq" ON "fasting_sessions" USING btree ("user_id") WHERE ended_at IS NULL AND deleted_at IS NULL;