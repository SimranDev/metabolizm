import { defineConfig } from "vitest/config";

// Deliberately narrow: the repo has no general test runner, only the groups
// masking regression suite (see CLAUDE.md "Groups — the masking invariant").
export default defineConfig({
  test: {
    include: ["apps/api/src/**/*.test.ts"],
  },
});
