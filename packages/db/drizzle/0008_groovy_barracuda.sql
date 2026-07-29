CREATE TYPE "public"."food_review_status" AS ENUM('pending', 'approved', 'rejected', 'needs_edit');--> statement-breakpoint
CREATE TABLE "food_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"food_id" uuid NOT NULL,
	"reporter_id" uuid,
	"reason" text NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "food_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"food_id" uuid NOT NULL,
	"food_version" bigint NOT NULL,
	"reviewer_id" uuid,
	"from_status" "food_review_status" NOT NULL,
	"to_status" "food_review_status" NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "review_status" "food_review_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "review_flags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "reviewed_by" uuid;--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "reviewed_version" bigint;--> statement-breakpoint
ALTER TABLE "food_reports" ADD CONSTRAINT "food_reports_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_reports" ADD CONSTRAINT "food_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_reports" ADD CONSTRAINT "food_reports_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_reviews" ADD CONSTRAINT "food_reviews_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_reviews" ADD CONSTRAINT "food_reviews_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "food_reports_open_uq" ON "food_reports" USING btree ("food_id","reporter_id") WHERE resolved_at IS NULL;--> statement-breakpoint
CREATE INDEX "food_reports_food_idx" ON "food_reports" USING btree ("food_id");--> statement-breakpoint
CREATE INDEX "food_reviews_food_created_idx" ON "food_reviews" USING btree ("food_id","created_at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "foods" ADD CONSTRAINT "foods_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "foods_review_queue_idx" ON "foods" USING btree ("created_at") WHERE review_status = 'pending' AND visibility = 'public' AND owner_id IS NOT NULL AND deleted_at IS NULL;--> statement-breakpoint
-- Hand-written: drizzle-kit cannot infer a data migration.
--
-- Carry the old is_verified boolean across to the review status before 0009
-- drops the column. Everything the catalog already trusted stays trusted:
-- system rows (the USDA import) and anything explicitly marked verified become
-- 'approved'. reviewed_version is pinned to the current version so a later
-- edit is visibly newer than the decision. Existing user rows keep the
-- 'pending' default the ADD COLUMN above gave them.
UPDATE "foods"
  SET "review_status" = 'approved', "reviewed_version" = "version"
  WHERE "owner_id" IS NULL OR "is_verified" = true;