// Diary request schemas live in @metabolizm/shared (also used by the mobile
// sync client); re-exported here so controller/service imports stay local.
export {
  diaryDaysQuerySchema,
  diaryRecentsQuerySchema,
  upsertDiaryEntriesSchema,
  type DiaryDaysQuery,
  type DiaryRecentsQuery,
  type UpsertDiaryEntriesInput,
} from "@metabolizm/shared";

import { z } from "zod";

export const entryIdParamSchema = z.uuid();
