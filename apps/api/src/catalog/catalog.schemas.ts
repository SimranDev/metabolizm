// Food input schemas live in @metabolizm/shared (also used by apps/admin);
// re-exported here so controller/service imports stay local.
export {
  createFoodPortionSchema,
  createFoodSchema,
  updateFoodSchema,
  type CreateFoodInput,
  type UpdateFoodInput,
} from "@metabolizm/shared";

import { z } from "zod";

export const listFoodsQuerySchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().max(512).optional(),
});

export type ListFoodsQuery = z.output<typeof listFoodsQuerySchema>;

export const foodIdParamSchema = z.uuid();
