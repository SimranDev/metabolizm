/**
 * System-catalog CRUD, writing directly with Drizzle. Deliberately NOT the
 * api's /v1/catalog routes: those are user-scoped and force source:"custom".
 * Every row here is ownerId:null, source:"system", visibility:"public",
 * isVerified:true — and only such rows are listed/edited (user foods are
 * invisible to this tool).
 */
import { foodPortions, foods } from "@metabolizm/db";
import type { FoodDto, FoodPortionDto } from "@metabolizm/shared";
import {
  createFoodPortionSchema,
  createFoodSchema,
  updateFoodFieldsSchema,
} from "@metabolizm/shared";
import { and, asc, desc, eq, ilike, isNull } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";
import type { FastifyInstance, FastifyReply } from "fastify";
import { uuidv7 } from "uuidv7";
import { z } from "zod";

import { isPgError, type Database } from "./db";

type FoodRow = typeof foods.$inferSelect;
type PortionRow = typeof foodPortions.$inferSelect;

// sourceRef is deliberately not in the shared createFoodSchema (never settable
// through the api's /v1/catalog); the admin tool carries it so a pasted USDA
// food dedupes against bulk imports instead of silently duplicating.
const adminCreateFoodSchema = createFoodSchema.extend({
  sourceRef: z.string().trim().min(1).max(200).nullish(),
});

const adminUpdateFoodSchema = updateFoodFieldsSchema
  .extend({
    portions: z
      .array(createFoodPortionSchema)
      .max(20)
      .optional()
      .refine(
        (portions) =>
          portions === undefined ||
          portions.filter((p) => p.isDefault).length <= 1,
        { message: "At most one portion may have isDefault=true" },
      ),
  })
  .refine((patch) => Object.values(patch).some((v) => v !== undefined), {
    message: "Patch must set at least one field",
  });

const listQuerySchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const idParamSchema = z.object({ id: z.uuid() });

/** Escape LIKE/ILIKE metacharacters; backslash is Postgres' default ESCAPE. */
function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function toPortionDto(row: PortionRow): FoodPortionDto {
  return {
    id: row.id,
    label: row.label,
    quantity: row.quantity,
    amountInBase: row.amountInBase,
    isDefault: row.isDefault,
  };
}

function toFoodDto(row: FoodRow, portions: PortionRow[]): FoodDto {
  return {
    id: row.id,
    ownerId: row.ownerId,
    name: row.name,
    brand: row.brand,
    description: row.description,
    barcode: row.barcode,
    sourceRef: row.sourceRef,
    source: row.source,
    baseUnit: row.baseUnit,
    servingSize: row.servingSize,
    servingLabel: row.servingLabel,
    energyKcal: row.energyKcal,
    proteinG: row.proteinG,
    carbsG: row.carbsG,
    fatG: row.fatG,
    nutrients: row.nutrients,
    visibility: row.visibility,
    isVerified: row.isVerified,
    popularity: row.popularity,
    forkedFrom: row.forkedFrom,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    portions: portions.map(toPortionDto),
  };
}

function validationError(reply: FastifyReply, error: z.ZodError) {
  return reply
    .code(400)
    .send({ error: "validation_failed", message: z.prettifyError(error) });
}

function conflictError(reply: FastifyReply) {
  return reply.code(409).send({
    error: "conflict",
    message:
      "A food with this id, barcode, or source ref already exists in the active catalog",
  });
}

/** Live system-catalog row filter. */
function systemFood(id: string): SQL {
  return and(
    eq(foods.id, id),
    isNull(foods.ownerId),
    isNull(foods.deletedAt),
  )!;
}

export function registerFoodRoutes(app: FastifyInstance, db: Database): void {
  const loadPortions = (foodId: string): Promise<PortionRow[]> =>
    db
      .select()
      .from(foodPortions)
      .where(eq(foodPortions.foodId, foodId))
      .orderBy(desc(foodPortions.isDefault), asc(foodPortions.label));

  app.post("/api/foods", async (request, reply) => {
    const parsed = adminCreateFoodSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);
    const input = parsed.data;
    const foodId = input.id ?? uuidv7();
    try {
      const dto = await db.transaction(async (tx) => {
        const [food] = await tx
          .insert(foods)
          .values({
            id: foodId,
            ownerId: null,
            name: input.name,
            brand: input.brand ?? null,
            description: input.description ?? null,
            barcode: input.barcode ?? null,
            sourceRef: input.sourceRef ?? null,
            source: "system",
            baseUnit: input.baseUnit,
            servingSize: input.servingSize,
            servingLabel: input.servingLabel ?? null,
            energyKcal: input.energyKcal,
            proteinG: input.proteinG,
            carbsG: input.carbsG,
            fatG: input.fatG,
            nutrients: input.nutrients,
            visibility: "public",
            isVerified: true,
          })
          .returning();
        const portions =
          input.portions.length === 0
            ? []
            : await tx
                .insert(foodPortions)
                .values(
                  input.portions.map((p) => ({
                    id: p.id ?? uuidv7(),
                    foodId,
                    label: p.label,
                    quantity: p.quantity,
                    amountInBase: p.amountInBase,
                    isDefault: p.isDefault,
                  })),
                )
                .returning();
        return toFoodDto(food, portions);
      });
      return reply.code(201).send(dto);
    } catch (error) {
      if (isPgError(error, "23505")) return conflictError(reply);
      throw error;
    }
  });

  app.get("/api/foods", async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) return validationError(reply, parsed.error);
    const query = parsed.data;

    const filters: SQL[] = [isNull(foods.ownerId), isNull(foods.deletedAt)];
    if (query.q) {
      filters.push(ilike(foods.name, `%${escapeLike(query.q)}%`));
    }
    const items = await db
      .select({
        id: foods.id,
        name: foods.name,
        brand: foods.brand,
        barcode: foods.barcode,
        baseUnit: foods.baseUnit,
        energyKcal: foods.energyKcal,
        proteinG: foods.proteinG,
        carbsG: foods.carbsG,
        fatG: foods.fatG,
        isVerified: foods.isVerified,
        updatedAt: foods.updatedAt,
      })
      .from(foods)
      .where(and(...filters))
      .orderBy(asc(foods.name), asc(foods.id))
      .limit(query.limit)
      .offset(query.offset);
    return reply.send({
      items: items.map((row) => ({
        ...row,
        updatedAt: row.updatedAt.toISOString(),
      })),
    });
  });

  app.get("/api/foods/:id", async (request, reply) => {
    const params = idParamSchema.safeParse(request.params);
    if (!params.success) return validationError(reply, params.error);
    const [row] = await db
      .select()
      .from(foods)
      .where(systemFood(params.data.id));
    if (!row) {
      return reply
        .code(404)
        .send({ error: "not_found", message: "Food not found" });
    }
    return reply.send(toFoodDto(row, await loadPortions(row.id)));
  });

  app.patch("/api/foods/:id", async (request, reply) => {
    const params = idParamSchema.safeParse(request.params);
    if (!params.success) return validationError(reply, params.error);
    const parsed = adminUpdateFoodSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);
    const id = params.data.id;
    const patch = parsed.data;

    const set: Partial<typeof foods.$inferInsert> = {};
    if (patch.name !== undefined) set.name = patch.name;
    if (patch.brand !== undefined) set.brand = patch.brand;
    if (patch.description !== undefined) set.description = patch.description;
    if (patch.barcode !== undefined) set.barcode = patch.barcode;
    if (patch.baseUnit !== undefined) set.baseUnit = patch.baseUnit;
    if (patch.servingSize !== undefined) set.servingSize = patch.servingSize;
    if (patch.servingLabel !== undefined) set.servingLabel = patch.servingLabel;
    if (patch.energyKcal !== undefined) set.energyKcal = patch.energyKcal;
    if (patch.proteinG !== undefined) set.proteinG = patch.proteinG;
    if (patch.carbsG !== undefined) set.carbsG = patch.carbsG;
    if (patch.fatG !== undefined) set.fatG = patch.fatG;
    if (patch.nutrients !== undefined) set.nutrients = patch.nutrients;

    try {
      const dto = await db.transaction(async (tx) => {
        const [updated] = await tx
          .update(foods)
          .set({
            ...set,
            version: sql`${foods.version} + 1`,
            updatedAt: new Date(),
          })
          .where(systemFood(id))
          .returning();
        if (!updated) return null;
        // Portions are replaced wholesale when provided.
        let portions: PortionRow[];
        if (patch.portions !== undefined) {
          await tx.delete(foodPortions).where(eq(foodPortions.foodId, id));
          portions =
            patch.portions.length === 0
              ? []
              : await tx
                  .insert(foodPortions)
                  .values(
                    patch.portions.map((p) => ({
                      id: p.id ?? uuidv7(),
                      foodId: id,
                      label: p.label,
                      quantity: p.quantity,
                      amountInBase: p.amountInBase,
                      isDefault: p.isDefault,
                    })),
                  )
                  .returning();
        } else {
          portions = await tx
            .select()
            .from(foodPortions)
            .where(eq(foodPortions.foodId, id))
            .orderBy(desc(foodPortions.isDefault), asc(foodPortions.label));
        }
        return toFoodDto(updated, portions);
      });
      if (!dto) {
        return reply
          .code(404)
          .send({ error: "not_found", message: "Food not found" });
      }
      return reply.send(dto);
    } catch (error) {
      if (isPgError(error, "23505")) return conflictError(reply);
      throw error;
    }
  });

  app.delete("/api/foods/:id", async (request, reply) => {
    const params = idParamSchema.safeParse(request.params);
    if (!params.success) return validationError(reply, params.error);
    const deleted = await db
      .update(foods)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(systemFood(params.data.id))
      .returning({ id: foods.id });
    if (deleted.length === 0) {
      return reply
        .code(404)
        .send({ error: "not_found", message: "Food not found" });
    }
    return reply.code(204).send();
  });
}
