// drizzle-kit does not load .env itself. apps/api/.env stays the single
// source of truth for DATABASE_URL; the path is relative to this package's
// cwd (drizzle-kit runs via `pnpm --filter @metabolizm/db db:*`).
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: "../../apps/api/.env" });

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    // Required by `drizzle-kit migrate` / `studio`; `generate` is offline.
    url: process.env.DATABASE_URL ?? "",
  },
});
