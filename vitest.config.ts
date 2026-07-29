import { defineConfig } from "vitest/config";

// Deliberately narrow: the repo has no general test runner. Four suites only,
// all guarding logic where a wrong answer is silent and plausible —
// groups/masking.test.ts (CLAUDE.md "Groups — the masking invariant"),
// weight/compute.test.ts (trend, projection and progress math),
// summaries/writers.test.ts (the two disjoint daily_summaries writers) and
// catalog/review-flags.test.ts (catalog review triage thresholds). None is an
// invitation to add unit tests elsewhere.
export default defineConfig({
  test: {
    include: ["apps/api/src/**/*.test.ts"],
  },
});
