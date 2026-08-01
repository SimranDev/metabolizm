// Water request schemas live in @metabolizm/shared (also used by the mobile
// client); re-exported here so controller/service imports stay local.
export {
  createWaterEntrySchema,
  putWaterGoalSchema,
  waterEntriesQuerySchema,
  waterSummaryQuerySchema,
  type CreateWaterEntryInput,
  type PutWaterGoalInput,
  type WaterEntriesQuery,
  type WaterSummaryQuery,
} from "@metabolizm/shared";

import { z } from "zod";

export const waterEntryIdParamSchema = z.uuid();
