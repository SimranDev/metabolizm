DROP INDEX "foods_barcode_active_uq";--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "markets" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "region" text DEFAULT 'NZ' NOT NULL;--> statement-breakpoint
-- Hand-written from here: drizzle-kit cannot infer a data migration.
--
-- Normalise every stored barcode to GTIN-14 (zero-left-padded), so UPC-A (12),
-- EAN-13 and EAN-8 all collapse to one comparable form. This runs AFTER the
-- old index is dropped and BEFORE the new one is created, because padding is
-- exactly what can surface a collision: 036000291452 and 0036000291452 are the
-- same product and become the same row key.
--
-- Only well-formed codes are touched. A barcode that is not 8/12/13/14 digits
-- was never a GTIN, so padding it would invent a value rather than normalise
-- one; those are left exactly as they are for a human to look at.
UPDATE "foods"
  SET "barcode" = lpad("barcode", 14, '0')
  WHERE "barcode" IS NOT NULL
    AND "barcode" ~ '^[0-9]+$'
    AND length("barcode") IN (8, 12, 13)
;--> statement-breakpoint
-- Abort rather than lose data. If two public rows normalised to the same GTIN,
-- the CREATE UNIQUE INDEX below would fail anyway with an opaque message and a
-- half-applied migration; this fails first and NAMES the colliding barcodes so
-- they can be merged by hand. Nothing is deleted, deduplicated or silently
-- picked between.
DO $$
DECLARE
  collisions text;
BEGIN
  SELECT string_agg(barcode || ' (x' || n || ')', ', ')
    INTO collisions
    FROM (
      SELECT barcode, count(*) AS n
        FROM foods
       WHERE barcode IS NOT NULL
         AND visibility = 'public'
         AND deleted_at IS NULL
       GROUP BY barcode
      HAVING count(*) > 1
    ) dupes;

  IF collisions IS NOT NULL THEN
    RAISE EXCEPTION
      'GTIN-14 normalisation produced duplicate public barcodes: %. Merge or unpublish these foods, then re-run the migration. No rows have been changed or dropped.',
      collisions;
  END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX "foods_barcode_public_uq" ON "foods" USING btree ("barcode") WHERE barcode IS NOT NULL AND visibility = 'public' AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "foods_markets_gin_idx" ON "foods" USING gin ("markets");--> statement-breakpoint
-- Backfill markets. The seeded catalog is USDA, so those rows are US. Anything
-- else stays '{}' = UNKNOWN, which regionRank treats as neutral rather than as
-- a mismatch — most of the catalog is unknown at first and penalising it would
-- bury it for every non-US user.
UPDATE "foods" SET "markets" = ARRAY['US'] WHERE "source_ref" LIKE 'fdc:%';
