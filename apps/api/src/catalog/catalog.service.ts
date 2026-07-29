import {
  foodPortions,
  foodReports,
  foodReviews,
  foods,
  users,
} from "@metabolizm/db";
import type {
  FoodDto,
  FoodFlag,
  FoodListItemDto,
  FoodPortionDto,
  FoodSearchResponse,
} from "@metabolizm/shared";
import {
  DEFAULT_REGION,
  FOOD_FLAG_SEVERITY,
  evaluateFoodFlags,
  isSupportedRegion,
  marketGroupOf,
  normalizeGtin,
} from "@metabolizm/shared";
import type { Region } from "@metabolizm/shared";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from "@nestjs/common";
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  like,
  ne,
  or,
  sql,
} from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import postgres from "postgres";
import { uuidv7 } from "uuidv7";
import { z } from "zod";

import { DB, type Database } from "../db/db.module";
import type {
  CreateFoodInput,
  ListFoodsQuery,
  UpdateFoodInput,
} from "./catalog.schemas";

type FoodRow = typeof foods.$inferSelect;
type PortionRow = typeof foodPortions.$inferSelect;
// Same derivation as summaries.service.ts — a transaction handle, not the
// root Database.
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

// Last row's sort key; keyset pagination over the search ORDER BY.
const cursorSchema = z.object({
  own: z.union([z.literal(0), z.literal(1)]),
  pre: z.union([z.literal(0), z.literal(1)]),
  // 2 exact market, 1 same market group OR unknown, 0 elsewhere.
  reg: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  ver: z.union([z.literal(0), z.literal(1)]),
  pop: z.number().int(),
  name: z.string(),
  id: z.uuid(),
});

type CursorPayload = z.output<typeof cursorSchema>;

function encodeCursor(cursor: CursorPayload): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeCursor(raw: string): CursorPayload {
  try {
    return cursorSchema.parse(
      JSON.parse(Buffer.from(raw, "base64url").toString("utf8")),
    );
  } catch {
    throw new BadRequestException("Invalid cursor");
  }
}

/** Escape LIKE/ILIKE metacharacters; backslash is Postgres' default ESCAPE. */
function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (c) => `\\${c}`);
}

// drizzle wraps driver errors (DrizzleQueryError with the PostgresError as
// its cause), so walk the cause chain instead of checking the top level.
function isPgError(error: unknown, code: string): boolean {
  let current: unknown = error;
  while (current instanceof Error) {
    if (current instanceof postgres.PostgresError) return current.code === code;
    current = current.cause;
  }
  return false;
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

/**
 * Rows the caller may read: their own, the system catalog, and anything
 * published public by anyone. `visibility` was written and never read before
 * the review queue existed, which is why a public user food was invisible to
 * everybody but its author.
 *
 * Callers must still AND in `isNull(foods.deletedAt)` themselves — both call
 * sites already do, and folding it in here would hide it.
 */
function visibleToCaller(userId: string | null): SQL {
  return userId
    ? or(
        eq(foods.ownerId, userId),
        isNull(foods.ownerId),
        eq(foods.visibility, "public"),
      )!
    : or(isNull(foods.ownerId), eq(foods.visibility, "public"))!;
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
    // Derived, not stored — there is one fact here and review_status owns it.
    isVerified: row.reviewStatus === "approved",
    popularity: row.popularity,
    forkedFrom: row.forkedFrom,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    portions: portions.map(toPortionDto),
  };
}

@Injectable()
export class CatalogService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async createFood(userId: string, input: CreateFoodInput): Promise<FoodDto> {
    const foodId = input.id ?? uuidv7();
    // Normalised at the write boundary so the column only ever holds GTIN-14 —
    // the whole point is that one product has one key regardless of whether it
    // was scanned as UPC-A, EAN-13 or typed by hand.
    const barcode = input.barcode ? normalizeGtin(input.barcode) : null;
    if (barcode?.kind === "store_local") {
      throw new BadRequestException(
        "That barcode is a store label (it encodes a weight or price), so it can't identify a product.",
      );
    }
    if (barcode?.kind === "invalid") {
      throw new BadRequestException(`Not a readable barcode (${barcode.reason})`);
    }
    const region = await this.callerRegion(userId);
    try {
      return await this.db.transaction(async (tx) => {
        // Triage runs at write time, not at review time: the flags are what
        // turn "an admin reads every row" into "an admin reads a handful".
        // Never blocking — a flagged food is still created and still goes live.
        const reviewFlags = [
          ...evaluateFoodFlags(input),
          ...(await this.duplicateFlags(tx, foodId, input.name, input.brand)),
          ...(await this.gtinFlags(
            tx,
            barcode?.kind === "gtin" ? barcode.value : null,
            input.visibility,
          )),
        ];
        const [food] = await tx
          .insert(foods)
          .values({
            id: foodId,
            ownerId: userId,
            reviewFlags,
            // reviewStatus: DB default ('pending')
            name: input.name,
            brand: input.brand ?? null,
            description: input.description ?? null,
            barcode: barcode?.kind === "gtin" ? barcode.value : null,
            // Stamped from the creator's region: someone in NZ adding a food
            // off a NZ packet is evidence it sells here.
            markets: [region],
            baseUnit: input.baseUnit,
            servingSize: input.servingSize,
            servingLabel: input.servingLabel ?? null,
            energyKcal: input.energyKcal,
            proteinG: input.proteinG,
            carbsG: input.carbsG,
            fatG: input.fatG,
            nutrients: input.nutrients,
            visibility: input.visibility,
            // source, popularity, version: DB defaults
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
    } catch (error) {
      if (isPgError(error, "23505")) {
        throw new ConflictException(
          "A food with this id or barcode already exists",
        );
      }
      if (isPgError(error, "23503")) {
        // TODO(auth): goes away once real auth guarantees the user exists.
        throw new UnauthorizedException("Unknown user");
      }
      throw error;
    }
  }

  async listFoods(
    userId: string | null,
    query: ListFoodsQuery,
  ): Promise<FoodSearchResponse> {
    const region = await this.callerRegion(userId);
    // Anonymous callers only see system foods, so their rank is a constant.
    // Cast makes it an expression: a bare integer in ORDER BY is a column
    // position to Postgres (parens don't help — still a Const node).
    const ownRank = userId
      ? sql<number>`case when ${foods.ownerId} = ${userId} then 1 else 0 end`
      : sql<number>`0::int`;
    // Approved rows outrank unreviewed ones. `pending` and `needs_edit` sit
    // together at 0 — a salvageable food stays findable, it just doesn't get
    // to look trusted.
    const approvedRank = sql<number>`case when ${foods.reviewStatus} = 'approved' then 1 else 0 end`;
    // Prefix tier: a name starting with q outranks a mere substring match no
    // matter the popularity ("Apples, raw" above "Pineapple, raw" for
    // q=apple). Constant when q is absent, same cast rationale as ownRank.
    const prefixRank = query.q
      ? sql<number>`(lower(${foods.name}) like ${escapeLike(query.q.toLowerCase()) + "%"})::int`
      : sql<number>`0::int`;
    // RANKS, NEVER FILTERS. A New Zealander who bought an American protein
    // powder must still find it, just lower — hard filtering would turn a
    // ranking problem into "your app doesn't have my food".
    //
    // Containment (`@>`) rather than `= ANY(...)`: only the operator form uses
    // the GIN index on markets. Empty markets means UNKNOWN and scores 1, the
    // same as a near-match — most of the catalog is unknown, and treating that
    // as a mismatch would bury the entire USDA import for every NZ user.
    const groupLiteral = sql`ARRAY[${sql.join(
      marketGroupOf(region).map((r) => sql`${r}`),
      sql`, `,
    )}]::text[]`;
    const regionRank = sql<number>`case
      when ${foods.markets} @> ARRAY[${region}]::text[] then 2
      when ${foods.markets} && ${groupLiteral} then 1
      when cardinality(${foods.markets}) = 0 then 1
      else 0 end`;
    const cursor = query.cursor ? decodeCursor(query.cursor) : null;

    const filters: SQL[] = [isNull(foods.deletedAt)];
    filters.push(visibleToCaller(userId));
    // Rejected rows are wrong-and-unfixable or spam; they leave search
    // entirely. They stay readable by id (see getFood) so reopening a diary
    // entry that referenced one still works.
    filters.push(ne(foods.reviewStatus, "rejected"));
    if (query.q) {
      // 1-3 chars prefix-match ("chi" while typing means "starts with chi"),
      // 4+ infix. Length judged on the raw trimmed q, before escaping grows
      // it. Both shapes use the GIN trigram index (prefix via its
      // anchor-padded trigrams).
      const escaped = escapeLike(query.q);
      filters.push(
        ilike(foods.name, query.q.length <= 3 ? `${escaped}%` : `%${escaped}%`),
      );
    }
    if (cursor) {
      // Mixed sort directions (DESC ×4, ASC ×2) rule out a tuple
      // comparison; expand the lexicographic "after" predicate instead.
      filters.push(sql`(
        ${ownRank} < ${cursor.own}
        or (${ownRank} = ${cursor.own} and (${prefixRank} < ${cursor.pre}
          or (${prefixRank} = ${cursor.pre} and (${regionRank} < ${cursor.reg}
            or (${regionRank} = ${cursor.reg} and (${approvedRank} < ${cursor.ver}
              or (${approvedRank} = ${cursor.ver} and (${foods.popularity} < ${cursor.pop}
                or (${foods.popularity} = ${cursor.pop} and (${foods.name} > ${cursor.name}
                  or (${foods.name} = ${cursor.name} and ${foods.id} > ${cursor.id}::uuid)))))))))))
      )`);
    }

    const rows = await this.db
      .select({
        id: foods.id,
        ownerId: foods.ownerId,
        name: foods.name,
        brand: foods.brand,
        source: foods.source,
        baseUnit: foods.baseUnit,
        servingSize: foods.servingSize,
        servingLabel: foods.servingLabel,
        energyKcal: foods.energyKcal,
        proteinG: foods.proteinG,
        carbsG: foods.carbsG,
        fatG: foods.fatG,
        reviewStatus: foods.reviewStatus,
        popularity: foods.popularity,
        // Selected (not recomputed in JS for the cursor) so Postgres lower()
        // and JS toLowerCase() can never disagree on the same row.
        pre: prefixRank.as("pre"),
        // Same discipline: the cursor's `ver` and `reg` components read back
        // the values Postgres actually sorted on, rather than a JS
        // re-derivation that could disagree on the same row.
        ver: approvedRank.as("ver"),
        reg: regionRank.as("reg"),
        // nutrients jsonb deliberately excluded from list results
      })
      .from(foods)
      .where(and(...filters))
      .orderBy(
        desc(ownRank),
        desc(prefixRank),
        desc(regionRank),
        desc(approvedRank),
        desc(foods.popularity),
        asc(foods.name),
        asc(foods.id),
      )
      .limit(query.limit + 1); // +1 row to detect a next page

    const page = rows.slice(0, query.limit);
    const last = page[page.length - 1];
    const nextCursor =
      rows.length > query.limit && last
        ? encodeCursor({
            own: userId !== null && last.ownerId === userId ? 1 : 0,
            pre: last.pre ? 1 : 0,
            reg: last.reg === 2 ? 2 : last.reg === 1 ? 1 : 0,
            ver: last.ver ? 1 : 0,
            pop: last.popularity,
            name: last.name,
            id: last.id,
          })
        : null;

    // Separate batched lookup instead of a JOIN: a join would multiply rows
    // (and corrupt limit/cursor math) if a food ever held two default rows.
    const defaults =
      page.length === 0
        ? []
        : await this.db
            .select({
              id: foodPortions.id,
              foodId: foodPortions.foodId,
              label: foodPortions.label,
              amountInBase: foodPortions.amountInBase,
            })
            .from(foodPortions)
            .where(
              and(
                inArray(
                  foodPortions.foodId,
                  page.map((r) => r.id),
                ),
                eq(foodPortions.isDefault, true),
              ),
            );
    const defaultByFood = new Map(defaults.map((d) => [d.foodId, d]));

    const items: FoodListItemDto[] = page.map((row) => {
      const portion = defaultByFood.get(row.id);
      return {
        id: row.id,
        name: row.name,
        brand: row.brand,
        source: row.source,
        baseUnit: row.baseUnit,
        servingSize: row.servingSize,
        servingLabel: row.servingLabel,
        energyKcal: row.energyKcal,
        proteinG: row.proteinG,
        carbsG: row.carbsG,
        fatG: row.fatG,
        reviewStatus: row.reviewStatus,
        isVerified: row.reviewStatus === "approved",
        isOwned: userId !== null && row.ownerId === userId,
        defaultPortion: portion
          ? {
              id: portion.id,
              label: portion.label,
              amountInBase: portion.amountInBase,
            }
          : null,
      };
    });

    return { items, nextCursor };
  }

  async getFood(userId: string | null, id: string): Promise<FoodDto> {
    const food = await this.loadVisible(userId, id);
    // Fire-and-forget popularity bump so ranking improves with usage. Never
    // awaited on the response path; a read must not fail over ranking
    // bookkeeping, so errors are swallowed (`.catch` also starts the lazy
    // drizzle builder). Leaves updatedAt/version alone on purpose —
    // popularity is ranking metadata, not a content change.
    void this.db
      .update(foods)
      .set({ popularity: sql`${foods.popularity} + 1` })
      .where(eq(foods.id, id))
      .catch(() => {});
    return toFoodDto(food, await this.loadPortions(id));
  }

  async updateFood(
    userId: string,
    id: string,
    patch: UpdateFoodInput,
  ): Promise<FoodDto> {
    const food = await this.loadVisible(userId, id);
    if (food.ownerId === null) {
      throw new ForbiddenException("System foods cannot be modified");
    }

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

    // Editing the numbers on an approved food re-opens the decision. Without
    // this, approval is a laundering step: publish something honest, get the
    // badge, then quietly rewrite the macros underneath it.
    const NUTRITION_FIELDS = [
      "energyKcal",
      "proteinG",
      "carbsG",
      "fatG",
      "nutrients",
      "baseUnit",
      "servingSize",
    ] as const;
    const nutritionChanged = NUTRITION_FIELDS.some(
      (f) => patch[f] !== undefined,
    );
    const requeue = nutritionChanged && food.reviewStatus === "approved";
    if (requeue) {
      set.reviewStatus = "pending";
      set.reviewedBy = null;
      set.reviewedAt = null;
      // reviewedVersion is deliberately kept: it records which version was
      // approved, which is what makes the edit visible as "newer than the
      // decision" rather than erasing that a decision ever happened.
    }

    try {
      return await this.db.transaction(async (tx) => {
        const portions = await tx
          .select()
          .from(foodPortions)
          .where(eq(foodPortions.foodId, id))
          .orderBy(desc(foodPortions.isDefault), asc(foodPortions.label));
        // Flags describe the row as it will be, so evaluate the merged result
        // rather than the patch.
        const merged = { ...food, ...set };
        const reviewFlags = [
          ...evaluateFoodFlags({ ...merged, portions }),
          ...(await this.duplicateFlags(tx, id, merged.name, merged.brand)),
        ];

        const [updated] = await tx
          .update(foods)
          .set({
            ...set,
            reviewFlags,
            version: sql`${foods.version} + 1`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(foods.id, id),
              eq(foods.ownerId, userId),
              isNull(foods.deletedAt),
            ),
          )
          .returning();
        if (!updated) throw new NotFoundException("Food not found");

        if (requeue) {
          // reviewerId null — nobody decided this, an edit did.
          await tx.insert(foodReviews).values({
            id: uuidv7(),
            foodId: id,
            foodVersion: updated.version,
            reviewerId: null,
            fromStatus: "approved",
            toStatus: "pending",
            note: "Auto-requeued: nutrition fields edited after approval",
          });
        }
        return toFoodDto(updated, portions);
      });
    } catch (error) {
      if (isPgError(error, "23505")) {
        throw new ConflictException("A food with this barcode already exists");
      }
      throw error;
    }
  }

  /**
   * Report another user's (or a system) food as wrong. An open report against
   * an approved food pulls it straight back into the queue — the badge is a
   * claim the catalog makes, so a credible challenge should retract it until
   * someone looks.
   */
  async reportFood(
    userId: string,
    foodId: string,
    reason: string,
  ): Promise<void> {
    const food = await this.loadVisible(userId, foodId);
    if (food.ownerId === userId) {
      throw new BadRequestException(
        "You cannot report your own food — edit or delete it instead",
      );
    }
    try {
      await this.db.transaction(async (tx) => {
        await tx.insert(foodReports).values({
          id: uuidv7(),
          foodId,
          reporterId: userId,
          reason,
        });
        if (food.reviewStatus === "approved") {
          const [updated] = await tx
            .update(foods)
            .set({ reviewStatus: "pending", reviewedBy: null, reviewedAt: null })
            .where(and(eq(foods.id, foodId), eq(foods.reviewStatus, "approved")))
            .returning({ version: foods.version });
          if (updated) {
            await tx.insert(foodReviews).values({
              id: uuidv7(),
              foodId,
              foodVersion: updated.version,
              reviewerId: null,
              fromStatus: "approved",
              toStatus: "pending",
              note: "Auto-requeued: user report",
            });
          }
        }
      });
    } catch (error) {
      if (isPgError(error, "23505")) {
        throw new ConflictException("You have already reported this food");
      }
      throw error;
    }
  }

  /**
   * The caller's food-database region, resolved once per search rather than
   * joined per row. Anonymous callers and unrecognised stored values fall back
   * to the default, so ranking degrades to "unknown markets rank neutrally"
   * instead of throwing.
   */
  private async callerRegion(userId: string | null): Promise<Region> {
    if (!userId) return DEFAULT_REGION;
    const [row] = await this.db
      .select({ region: users.region })
      .from(users)
      .where(eq(users.id, userId));
    return row && isSupportedRegion(row.region) ? row.region : DEFAULT_REGION;
  }

  /**
   * Look a food up by scanned barcode. Three outcomes the client must render
   * differently, which is why they are distinct rather than one 404:
   *   - found
   *   - not found (404) → offer to create it, barcode prefilled
   *   - store-local (422) → a supermarket's own weight/price label, which has
   *     no globally identified product behind it and can NEVER resolve. Shown
   *     as a plain "not found" the user just rescans the same label forever.
   */
  async getFoodByBarcode(userId: string | null, raw: string): Promise<FoodDto> {
    const result = normalizeGtin(raw);
    if (result.kind === "store_local") {
      throw new UnprocessableEntityException({
        error: "store_local_barcode",
        message:
          "That's a store label — the digits encode a weight or price, not a product. Enter the food manually.",
      });
    }
    if (result.kind === "invalid") {
      throw new BadRequestException(`Not a readable barcode (${result.reason})`);
    }
    const [row] = await this.db
      .select()
      .from(foods)
      .where(
        and(
          eq(foods.barcode, result.value),
          isNull(foods.deletedAt),
          ne(foods.reviewStatus, "rejected"),
          visibleToCaller(userId),
        ),
      )
      .limit(1);
    if (!row) throw new NotFoundException("No food with that barcode");
    return toFoodDto(row, await this.loadPortions(row.id));
  }

  /**
   * The one flag code that needs a database. A same-name-and-brand active row
   * is the signal that someone re-typed a food that already exists — the main
   * way the queue fills with noise once "create a food" becomes a primary flow.
   */
  /**
   * `first_record_for_gtin` — the highest-blast-radius thing a user can do.
   *
   * A barcode is a GLOBAL key, and the public-barcode unique index makes it
   * first-writer-wins: whoever adds the first public record for a GTIN owns it
   * permanently, everybody who scans that product gets their numbers, and
   * nobody can add a competing record (they get a 409). One bad hand-typed
   * food misleads one person; one bad barcode record misleads everyone who
   * ever scans it. In NZ, where open-database coverage is thin and
   * scan → not-found → add-it is a PRIMARY flow, that is routine rather than a
   * corner case — hence the barcode-first ordering in the admin queue.
   *
   * Fires only when the record is also UNCORROBORATED. A GTIN already carried
   * by a system row or an Open Food Facts import has something to check
   * against, so flagging it would just add noise to every barcoded create.
   */
  private async gtinFlags(
    tx: Tx,
    gtin: string | null,
    visibility: "private" | "public",
  ): Promise<FoodFlag[]> {
    // A private food is visible only to its author, so it carries no blast
    // radius and never contends for the public barcode namespace.
    if (!gtin || visibility !== "public") return [];
    const [corroborating] = await tx
      .select({ id: foods.id })
      .from(foods)
      .where(
        and(
          eq(foods.barcode, gtin),
          isNull(foods.deletedAt),
          or(isNull(foods.ownerId), like(foods.sourceRef, "off:%")),
        ),
      )
      .limit(1);
    if (corroborating) return [];
    return [
      {
        code: "first_record_for_gtin",
        severity: FOOD_FLAG_SEVERITY.first_record_for_gtin,
        detail: `First and only record for barcode ${gtin}; nothing corroborates it, and everyone who scans this product will get these numbers.`,
      },
    ];
  }

  private async duplicateFlags(
    tx: Tx,
    selfId: string,
    name: string,
    brand: string | null | undefined,
  ): Promise<FoodFlag[]> {
    const [dupe] = await tx
      .select({ id: foods.id })
      .from(foods)
      .where(
        and(
          isNull(foods.deletedAt),
          ne(foods.id, selfId),
          sql`lower(${foods.name}) = lower(${name})`,
          brand
            ? sql`lower(${foods.brand}) = lower(${brand})`
            : isNull(foods.brand),
        ),
      )
      .limit(1);
    if (!dupe) return [];
    return [
      {
        code: "duplicate_name_brand",
        severity: FOOD_FLAG_SEVERITY.duplicate_name_brand,
        detail: brand
          ? `An active food already exists with this name and brand (${dupe.id}).`
          : `An active unbranded food already exists with this name (${dupe.id}).`,
      },
    ];
  }

  async deleteFood(userId: string, id: string): Promise<void> {
    const food = await this.loadVisible(userId, id);
    if (food.ownerId === null) {
      throw new ForbiddenException("System foods cannot be deleted");
    }
    // Rows-affected is checked rather than assumed: loadVisible now also
    // returns other people's public foods, so without this a delete of one
    // would match zero rows and still answer 204 — a silent no-op.
    const deleted = await this.db
      .update(foods)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(foods.id, id),
          eq(foods.ownerId, userId),
          isNull(foods.deletedAt),
        ),
      )
      .returning({ id: foods.id });
    if (deleted.length === 0) throw new NotFoundException("Food not found");
  }

  /**
   * Not found, soft-deleted, and other users' PRIVATE foods all 404 — never
   * leak. Public foods (including `rejected` ones) are readable by id on
   * purpose: a diary entry that referenced one must still reopen for editing,
   * and rejection removes a food from search, not from history.
   */
  private async loadVisible(
    userId: string | null,
    id: string,
  ): Promise<FoodRow> {
    const [row] = await this.db
      .select()
      .from(foods)
      .where(
        and(eq(foods.id, id), isNull(foods.deletedAt), visibleToCaller(userId)),
      );
    if (!row) throw new NotFoundException("Food not found");
    return row;
  }

  private async loadPortions(foodId: string): Promise<PortionRow[]> {
    return this.db
      .select()
      .from(foodPortions)
      .where(eq(foodPortions.foodId, foodId))
      .orderBy(desc(foodPortions.isDefault), asc(foodPortions.label));
  }
}
