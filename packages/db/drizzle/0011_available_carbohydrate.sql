-- Hand-written, no schema change: converts already-imported USDA rows from
-- TOTAL carbohydrate to AVAILABLE carbohydrate (fibre excluded).
--
-- THE INVARIANT: `foods.carbs_g` is always available carbohydrate, matching an
-- AU/NZ nutrition information panel, which is what a user reads off a packet.
-- USDA reports "by difference", which INCLUDES fibre. Both were being summed
-- into one column, one daily_summaries rollup and one target.
--
-- This is a MIGRATION rather than a script on purpose. Subtracting fibre is not
-- idempotent — running it twice double-subtracts, and nothing on the row
-- distinguishes converted from unconverted. Drizzle's journal makes "exactly
-- once" a guarantee instead of a convention. New imports need no backfill:
-- usda-mapper.ts now converts at the import boundary.
--
-- Logged history is deliberately untouched. diary_entries carry a snapshot
-- taken at log time and daily_summaries is a projection of those, so nothing
-- a user has already recorded changes underneath them.
UPDATE "foods"
   SET "carbs_g" = GREATEST(0, ROUND(("carbs_g" - ("nutrients"->>'fiber')::numeric)::numeric, 2)),
       "version" = "version" + 1,
       "updated_at" = now()
 WHERE "source_ref" LIKE 'fdc:%'
   AND "nutrients" ? 'fiber'
   -- jsonb_typeof guards against a non-numeric value poisoning the cast.
   AND jsonb_typeof("nutrients"->'fiber') = 'number'
;--> statement-breakpoint
-- Rows with NO fibre value cannot be converted, so they are marked rather than
-- guessed at. `carbs_include_fibre` keeps them findable instead of silently
-- wrong, and is the same flag usda-mapper.ts stamps going forward.
UPDATE "foods"
   SET "review_flags" = "review_flags" || '[{"code":"carbs_include_fibre","severity":"medium","detail":"Source had no fibre value (1079); carbs are TOTAL, not available."}]'::jsonb
 WHERE "source_ref" LIKE 'fdc:%'
   AND NOT ("nutrients" ? 'fiber' AND jsonb_typeof("nutrients"->'fiber') = 'number')
   AND NOT ("review_flags" @> '[{"code":"carbs_include_fibre"}]'::jsonb);
