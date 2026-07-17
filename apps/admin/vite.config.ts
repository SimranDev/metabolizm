// Dev-only SPA; /api is proxied to the Fastify server (server/index.ts).
// dotenv loads apps/admin/.env so the proxy follows a custom PORT.
import "dotenv/config";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: "web",
  plugins: [react()],
  // Workspace-linked deps skip prebundling by default, but shared's default
  // export is CJS (dist/) — force it through esbuild.
  optimizeDeps: { include: ["@metabolizm/shared"] },
  server: {
    proxy: {
      "/api": `http://localhost:${process.env.PORT ?? "4000"}`,
    },
  },
});
