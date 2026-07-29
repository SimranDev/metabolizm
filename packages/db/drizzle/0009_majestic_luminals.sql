-- Separate from 0008 so the backfill there can still read is_verified. From
-- here "verified" is derived (review_status = 'approved') and exists only as a
-- DTO convenience field — never again as a stored column.
ALTER TABLE "foods" DROP COLUMN "is_verified";