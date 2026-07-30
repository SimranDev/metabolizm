/**
 * Catalog review queue — the ONLY routes in this tool that EDIT user foods.
 * (sync.ts copies user rows, foods included, but verbatim from a live database:
 * it never derives, corrects or decides anything about one.)
 *
 * foods.ts guards the system catalog with systemFood() (owner_id IS NULL).
 * That filter is deliberately not loosened to cover review; this module has
 * its own userFood() (owner_id IS NOT NULL) and the two never meet. An admin
 * correction here can therefore never silently rewrite a system row, and a
 * system-catalog edit there can never touch somebody's personal food.
 *
 * Public user foods are LIVE the moment they are created — review is
 * after-the-fact, and nothing in here gates visibility. What it changes is
 * whether a food ranks as approved and wears a verified badge.
 */
import { foodPortions, foodReports, foodReviews, foods, users } from "@metabolizm/db";
import type { FoodDto, FoodFlag, FoodPortionDto } from "@metabolizm/shared";
import {
  FOOD_FLAG_SEVERITY_RANK,
  atwaterKcal,
  createFoodPortionSchema,
  evaluateFoodFlags,
  foodReviewStatusSchema,
  updateFoodFieldsSchema,
} from "@metabolizm/shared";
import { and, asc, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { FastifyInstance, FastifyReply } from "fastify";
import { uuidv7 } from "uuidv7";
import { z } from "zod";

import { isPgError, type Database } from "./db";
import type { Env } from "./env";

type FoodRow = typeof foods.$inferSelect;
type PortionRow = typeof foodPortions.$inferSelect;

const queueQuerySchema = z.object({
  status: foodReviewStatusSchema.default("pending"),
  flag: z.string().trim().min(1).max(64).optional(),
  severity: z.enum(["high", "medium", "low"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const decisionSchema = z.object({
  status: foodReviewStatusSchema,
  note: z.string().trim().max(2000).optional(),
});

// Mirrors adminUpdateFoodSchema in foods.ts, including the wholesale portion
// replacement. Deliberately a separate declaration: the two paths write
// different row populations and should be free to diverge.
const reviewUpdateFoodSchema = updateFoodFieldsSchema
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
    message: "Patch must set at least one field" },
  );

const idParamSchema = z.object({ id: z.uuid() });

function validationError(reply: FastifyReply, error: z.ZodError) {
  return reply
    .code(400)
    .send({ error: "validation_failed", message: z.prettifyError(error) });
}

function notFound(reply: FastifyReply) {
  return reply.code(404).send({ error: "not_found", message: "Food not found" });
}

/**
 * Live USER food filter — the counterpart to systemFood() in foods.ts, kept
 * separate on purpose. Never widen this to include owner_id IS NULL.
 */
function userFood(id: string): SQL {
  return and(
    eq(foods.id, id),
    isNotNull(foods.ownerId),
    isNull(foods.deletedAt),
  )!;
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
    reviewStatus: row.reviewStatus,
    reviewFlags: row.reviewFlags,
    isVerified: row.reviewStatus === "approved",
    popularity: row.popularity,
    forkedFrom: row.forkedFrom,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    portions: portions.map(toPortionDto),
  };
}

export function registerReviewRoutes(
  app: FastifyInstance,
  db: Database,
  env: Env,
): void {
  const loadPortions = (foodId: string): Promise<PortionRow[]> =>
    db
      .select()
      .from(foodPortions)
      .where(eq(foodPortions.foodId, foodId))
      .orderBy(desc(foodPortions.isDefault), asc(foodPortions.label));

  app.get("/api/review/queue", async (request, reply) => {
    const parsed = queueQuerySchema.safeParse(request.query);
    if (!parsed.success) return validationError(reply, parsed.error);
    const query = parsed.data;

    const filters: SQL[] = [
      isNotNull(foods.ownerId),
      isNull(foods.deletedAt),
      eq(foods.visibility, "public"),
      eq(foods.reviewStatus, query.status),
    ];
    if (query.flag) {
      filters.push(
        sql`${foods.reviewFlags} @> ${JSON.stringify([{ code: query.flag }])}::jsonb`,
      );
    }
    if (query.severity) {
      filters.push(
        sql`${foods.reviewFlags} @> ${JSON.stringify([{ severity: query.severity }])}::jsonb`,
      );
    }

    const openReports = db
      .select({
        foodId: foodReports.foodId,
        openCount: sql<number>`count(*)::int`.as("open_count"),
      })
      .from(foodReports)
      .where(isNull(foodReports.resolvedAt))
      .groupBy(foodReports.foodId)
      .as("open_reports");

    const rows = await db
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
        reviewStatus: foods.reviewStatus,
        reviewFlags: foods.reviewFlags,
        createdAt: foods.createdAt,
        ownerEmail: users.email,
        openReports: sql<number>`coalesce(${openReports.openCount}, 0)`,
      })
      .from(foods)
      .leftJoin(users, eq(users.id, foods.ownerId))
      .leftJoin(openReports, eq(openReports.foodId, foods.id))
      .where(and(...filters))
      // Barcode-bearing rows first, regardless of anything else: a barcode is
      // a GLOBAL key. One bad hand-typed food misleads the person who typed
      // it; one bad barcode record is served to everyone who ever scans that
      // product, and (under the public-barcode unique index) nobody else can
      // add a competing record. Then severity, then FIFO so old rows in a band
      // cannot starve behind a steady trickle of new ones.
      .orderBy(
        desc(sql`(${foods.barcode} is not null)`),
        desc(sql`
          case
            when ${foods.reviewFlags} @> '[{"severity":"high"}]'::jsonb then 3
            when ${foods.reviewFlags} @> '[{"severity":"medium"}]'::jsonb then 2
            when ${foods.reviewFlags} @> '[{"severity":"low"}]'::jsonb then 1
            else 0
          end`),
        asc(foods.createdAt),
      )
      .limit(query.limit)
      .offset(query.offset);

    return reply.send({
      items: rows.map((row) => {
        const computedKcal = atwaterKcal(row);
        return {
          ...row,
          createdAt: row.createdAt.toISOString(),
          // The single comparison that resolves most of the queue at a glance.
          computedKcal: Math.round(computedKcal * 10) / 10,
          kcalDelta: Math.round((row.energyKcal - computedKcal) * 10) / 10,
          maxSeverity: maxSeverity(row.reviewFlags),
        };
      }),
    });
  });

  app.get("/api/review/foods/:id", async (request, reply) => {
    const params = idParamSchema.safeParse(request.params);
    if (!params.success) return validationError(reply, params.error);
    const id = params.data.id;

    const [row] = await db
      .select({ food: foods, ownerEmail: users.email })
      .from(foods)
      .leftJoin(users, eq(users.id, foods.ownerId))
      .where(userFood(id));
    if (!row) return notFound(reply);

    const [portions, reports, history] = await Promise.all([
      loadPortions(id),
      db
        .select({
          id: foodReports.id,
          reason: foodReports.reason,
          reporterEmail: users.email,
          resolvedAt: foodReports.resolvedAt,
          createdAt: foodReports.createdAt,
        })
        .from(foodReports)
        .leftJoin(users, eq(users.id, foodReports.reporterId))
        .where(eq(foodReports.foodId, id))
        .orderBy(desc(foodReports.createdAt)),
      db
        .select({
          id: foodReviews.id,
          foodVersion: foodReviews.foodVersion,
          fromStatus: foodReviews.fromStatus,
          toStatus: foodReviews.toStatus,
          note: foodReviews.note,
          reviewerEmail: users.email,
          createdAt: foodReviews.createdAt,
        })
        .from(foodReviews)
        .leftJoin(users, eq(users.id, foodReviews.reviewerId))
        .where(eq(foodReviews.foodId, id))
        .orderBy(desc(foodReviews.createdAt)),
    ]);

    const computedKcal = atwaterKcal(row.food);
    return reply.send({
      food: toFoodDto(row.food, portions),
      ownerEmail: row.ownerEmail,
      computedKcal: Math.round(computedKcal * 10) / 10,
      reports: reports.map((r) => ({
        ...r,
        resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
        createdAt: r.createdAt.toISOString(),
      })),
      history: history.map((h) => ({
        ...h,
        createdAt: h.createdAt.toISOString(),
      })),
    });
  });

  /**
   * Admin correction of a user food. Deliberately does NOT touch
   * review_status: correcting a food and deciding about it are two separate
   * acts, and collapsing them would mean every fix silently approves.
   */
  app.patch("/api/review/foods/:id", async (request, reply) => {
    const params = idParamSchema.safeParse(request.params);
    if (!params.success) return validationError(reply, params.error);
    const parsed = reviewUpdateFoodSchema.safeParse(request.body);
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
    if (patch.visibility !== undefined) set.visibility = patch.visibility;

    try {
      const dto = await db.transaction(async (tx) => {
        const [current] = await tx.select().from(foods).where(userFood(id));
        if (!current) return null;

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

        const merged = { ...current, ...set };
        const [updated] = await tx
          .update(foods)
          .set({
            ...set,
            reviewFlags: evaluateFoodFlags({ ...merged, portions }),
            version: sql`${foods.version} + 1`,
            updatedAt: new Date(),
          })
          .where(userFood(id))
          .returning();
        if (!updated) return null;
        return toFoodDto(updated, portions);
      });
      if (!dto) return notFound(reply);
      return reply.send(dto);
    } catch (error) {
      if (isPgError(error, "23505")) {
        return reply.code(409).send({
          error: "conflict",
          message: "A food with this barcode already exists",
        });
      }
      throw error;
    }
  });

  app.post("/api/review/foods/:id/decision", async (request, reply) => {
    const params = idParamSchema.safeParse(request.params);
    if (!params.success) return validationError(reply, params.error);
    const parsed = decisionSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);
    const id = params.data.id;
    const { status, note } = parsed.data;

    const result = await db.transaction(async (tx) => {
      const [current] = await tx.select().from(foods).where(userFood(id));
      if (!current) return { kind: "not_found" as const };
      // A no-op decision would append a from===to row to an append-only
      // trail, which reads later as "someone reviewed this twice".
      if (current.reviewStatus === status) {
        return { kind: "noop" as const, status };
      }

      const now = new Date();
      const [updated] = await tx
        .update(foods)
        .set({
          reviewStatus: status,
          reviewedBy: env.ADMIN_REVIEWER_ID ?? null,
          reviewedAt: now,
          reviewedVersion: current.version,
        })
        .where(userFood(id))
        .returning();
      await tx.insert(foodReviews).values({
        id: uuidv7(),
        foodId: id,
        foodVersion: current.version,
        reviewerId: env.ADMIN_REVIEWER_ID ?? null,
        fromStatus: current.reviewStatus,
        toStatus: status,
        note: note ?? null,
      });
      return { kind: "ok" as const, food: updated };
    });

    if (result.kind === "not_found") return notFound(reply);
    if (result.kind === "noop") {
      return reply.code(409).send({
        error: "conflict",
        message: `Food is already ${result.status}`,
      });
    }
    return reply.send(toFoodDto(result.food, await loadPortions(id)));
  });

  app.post("/api/review/reports/:id/resolve", async (request, reply) => {
    const params = idParamSchema.safeParse(request.params);
    if (!params.success) return validationError(reply, params.error);
    const [resolved] = await db
      .update(foodReports)
      .set({
        resolvedAt: new Date(),
        resolvedBy: env.ADMIN_REVIEWER_ID ?? null,
      })
      .where(
        and(
          eq(foodReports.id, params.data.id),
          isNull(foodReports.resolvedAt),
        ),
      )
      .returning({ id: foodReports.id });
    if (!resolved) {
      return reply
        .code(404)
        .send({ error: "not_found", message: "Open report not found" });
    }
    return reply.send({ id: resolved.id });
  });
}

function maxSeverity(flags: FoodFlag[]): "high" | "medium" | "low" | null {
  let best: "high" | "medium" | "low" | null = null;
  for (const f of flags) {
    if (
      best === null ||
      FOOD_FLAG_SEVERITY_RANK[f.severity] > FOOD_FLAG_SEVERITY_RANK[best]
    ) {
      best = f.severity;
    }
  }
  return best;
}
