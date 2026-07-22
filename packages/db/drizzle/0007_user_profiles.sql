CREATE TYPE "public"."activity_level" AS ENUM('sedentary', 'light', 'moderate', 'very', 'athlete');--> statement-breakpoint
CREATE TYPE "public"."goal" AS ENUM('lose', 'gain-muscle', 'recomp', 'maintain', 'improve-health');--> statement-breakpoint
CREATE TYPE "public"."height_unit" AS ENUM('cm', 'ftin');--> statement-breakpoint
CREATE TYPE "public"."sex" AS ENUM('male', 'female', 'other');--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"goal" "goal" NOT NULL,
	"sex" "sex" NOT NULL,
	"dob" date NOT NULL,
	"height_cm" numeric(5, 1) NOT NULL,
	"weight_kg" numeric(6, 2) NOT NULL,
	"goal_weight_kg" numeric(6, 2),
	"activity_level" "activity_level" NOT NULL,
	"height_unit" "height_unit" DEFAULT 'cm' NOT NULL,
	"plan_id" text NOT NULL,
	"custom_weekly_rate_kg" numeric(5, 3),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_profiles_user_id_uq" ON "user_profiles" USING btree ("user_id");