// Internal admin server — dev-only, never deployed. Run via `pnpm admin`
// (root) or `tsx watch server/index.ts` from apps/admin.
import "dotenv/config";
import Fastify from "fastify";

import { createDb } from "./db";
import { loadEnv } from "./env";
import { registerFoodRoutes } from "./foods";
import { registerParseRoute } from "./parse";

async function main(): Promise<void> {
  const env = loadEnv();
  const db = createDb(env.DATABASE_URL);

  const app = Fastify({ logger: true });
  app.get("/api/health", () => ({ ok: true }));
  registerFoodRoutes(app, db);
  registerParseRoute(app);
  app.addHook("onClose", async () => {
    await db.$client.end();
  });

  // Internal tool: loopback only.
  await app.listen({ port: env.PORT, host: "127.0.0.1" });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
