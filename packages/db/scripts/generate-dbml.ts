// Emits a DBML snapshot of the Drizzle schema for visual ERDs. Paste the
// generated packages/db/schema.dbml into https://dbdiagram.io or
// https://azimutt.app to render and export a diagram (PNG/PDF/SVG).
// Regenerate after editing src/schema.ts.
//
//   pnpm db:dbml                       (root proxy)
//   pnpm --filter @metabolizm/db db:dbml
//
// Lives outside the build tsconfig (include: ["src"]), like drizzle.config.ts,
// so it never lands in dist/ or the published package.
import { fileURLToPath } from "node:url";

import { pgGenerate } from "drizzle-dbml-generator";

import * as schema from "../src/schema.ts";

// Relations come from the .references() foreign keys on the tables, so
// relational:false (the default) is correct — the schema does not use
// drizzle-orm's relations() helper.
const out = fileURLToPath(new URL("../schema.dbml", import.meta.url));
pgGenerate({ schema, out, relational: false });

console.log(`Wrote DBML → ${out}`);
