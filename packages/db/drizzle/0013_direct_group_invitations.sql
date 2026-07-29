CREATE TYPE "public"."group_invite_kind" AS ENUM('link', 'direct');--> statement-breakpoint
ALTER TABLE "group_invites" ADD COLUMN "kind" "group_invite_kind" DEFAULT 'link' NOT NULL;--> statement-breakpoint
ALTER TABLE "group_invites" ADD COLUMN "invited_user_id" uuid;--> statement-breakpoint
ALTER TABLE "group_invites" ADD COLUMN "invited_email" text;--> statement-breakpoint
ALTER TABLE "group_invites" ADD COLUMN "declined_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "group_invites" ADD COLUMN "requires_approval" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "group_invites" ADD CONSTRAINT "group_invites_invited_user_id_users_id_fk" FOREIGN KEY ("invited_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "group_invites_group_invited_user_uq" ON "group_invites" USING btree ("group_id","invited_user_id") WHERE kind = 'direct' AND revoked_at IS NULL AND declined_at IS NULL AND use_count = 0;--> statement-breakpoint
CREATE INDEX "group_invites_invited_user_idx" ON "group_invites" USING btree ("invited_user_id") WHERE kind = 'direct';--> statement-breakpoint
CREATE INDEX "users_email_lower_idx" ON "users" USING btree (lower("email"));--> statement-breakpoint
ALTER TABLE "group_invites" ADD CONSTRAINT "group_invites_direct_check" CHECK (kind <> 'direct' OR (invited_user_id IS NOT NULL AND max_uses = 1 AND requires_approval = false));--> statement-breakpoint
ALTER TABLE "group_invites" ADD CONSTRAINT "group_invites_link_check" CHECK (kind <> 'link' OR invited_user_id IS NULL);