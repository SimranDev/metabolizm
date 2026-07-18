/**
 * One-off, idempotent data fix for the system catalog: strip USDA name
 * boilerplate and normalize NLEA/RACC portion-label jargon. The same rules
 * run at import time (server/usda-clean.ts), so re-running the importer
 * cannot reintroduce what this removes.
 *
 * Usage: pnpm --filter admin cleanup:usda
 */
import "dotenv/config";

import { foodPortions, foods } from "@metabolizm/db";
import { and, eq, isNull, sql } from "drizzle-orm";

import { createDb } from "../server/db";
import { loadEnv } from "../server/env";
import { cleanFoodName, cleanPortionLabel } from "../server/usda-clean";

async function main(): Promise<void> {
  const env = loadEnv();
  const db = createDb(env.DATABASE_URL);
  try {
    await db.transaction(async (tx) => {
      const nameRows = await tx
        .select({ id: foods.id, name: foods.name })
        .from(foods)
        .where(and(eq(foods.source, "system"), isNull(foods.deletedAt)));
      let namesChanged = 0;
      for (const row of nameRows) {
        const cleaned = cleanFoodName(row.name);
        if (cleaned === row.name) continue;
        namesChanged += 1;
        console.log(`name:  ${row.name} -> ${cleaned}`);
        await tx
          .update(foods)
          .set({
            name: cleaned,
            version: sql`${foods.version} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(foods.id, row.id));
      }

      const portionRows = await tx
        .select({ id: foodPortions.id, label: foodPortions.label })
        .from(foodPortions)
        .innerJoin(foods, eq(foodPortions.foodId, foods.id))
        .where(and(eq(foods.source, "system"), isNull(foods.deletedAt)));
      let labelsChanged = 0;
      for (const row of portionRows) {
        const cleaned = cleanPortionLabel(row.label);
        if (cleaned === row.label) continue;
        labelsChanged += 1;
        console.log(`label: ${row.label} -> ${cleaned}`);
        await tx
          .update(foodPortions)
          .set({ label: cleaned })
          .where(eq(foodPortions.id, row.id));
      }

      console.log(`\nfood names updated:     ${namesChanged} of ${nameRows.length}`);
      console.log(`portion labels updated: ${labelsChanged} of ${portionRows.length}`);
    });
  } finally {
    await db.$client.end();
  }
}

void main();
