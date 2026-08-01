// Fasting request schemas live in @metabolizm/shared (also used by the mobile
// client); re-exported here so controller/service imports stay local.
export {
  endFastSchema,
  fastingSessionsQuerySchema,
  startFastSchema,
  type EndFastInput,
  type FastingSessionsQuery,
  type StartFastInput,
} from "@metabolizm/shared";

import { z } from "zod";

export const fastingSessionIdParamSchema = z.uuid();
