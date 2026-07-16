import { readFileSync } from "node:fs";
import { join } from "node:path";

// dist/version.js -> ../package.json resolves to the api package.json both in
// the workspace (apps/api/) and in the pnpm-deployed Docker image (/app/).
const pkg = JSON.parse(
  readFileSync(join(__dirname, "..", "package.json"), "utf8"),
) as { version: string };

export const APP_VERSION: string = pkg.version;
