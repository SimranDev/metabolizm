/**
 * Production migration runner: `node dist/migrate.js` (or, from a deployed
 * app, `node node_modules/@metabolizm/db/dist/migrate.js`). Applies the SQL
 * in ../drizzle using drizzle-orm's migrator — no drizzle-kit needed, so it
 * works with production dependencies only. Local dev keeps `pnpm db:migrate`.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { join } from "node:path";
import postgres from "postgres";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const client = postgres(url, { max: 1 });
  try {
    await migrate(drizzle(client), {
      migrationsFolder: join(__dirname, "../drizzle"),
    });
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
