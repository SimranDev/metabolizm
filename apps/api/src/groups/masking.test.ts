/**
 * Regression suite for the groups masking invariant (CLAUDE.md → "Groups —
 * the masking invariant"). This is the repo's only test suite; it exists
 * because a masking regression leaks another member's nutrition data, which
 * no type check can catch.
 *
 * Everything here runs against the pure masking/adherence layer plus the
 * exported query builder — no database, no HTTP.
 */
import * as schema from "@metabolizm/db";
import {
  CATEGORY_SHARE_DEFAULTS,
  groupSharePatchSchema,
  groupShareConfigSchema,
  SHARE_NOTHING,
  type GroupShareConfig,
} from "@metabolizm/shared";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { describe, expect, it } from "vitest";

import type { DaySummaryFacts } from "./adherence";
import { windowAdherencePct } from "./adherence";
import { localDateFor } from "./dates";
import {
  buildLeaderboardEntries,
  buildMemberDayCard,
  maskDiaryEntries,
  normalizeShareConfig,
  type DiaryEntryFacts,
  type MemberDayFacts,
} from "./masking";
import { activeMembersQuery } from "./queries";

const SHARE_KEYS = [
  "adherenceOnly",
  "calories",
  "macros",
  "mealNames",
  "mealDetail",
  "weightTrend",
  "streaks",
] as const satisfies readonly (keyof GroupShareConfig)[];

/** All 128 share-config permutations. */
function allConfigs(): GroupShareConfig[] {
  const out: GroupShareConfig[] = [];
  for (let mask = 0; mask < 1 << SHARE_KEYS.length; mask += 1) {
    const config = { ...SHARE_NOTHING };
    SHARE_KEYS.forEach((key, i) => {
      config[key] = (mask & (1 << i)) !== 0;
    });
    out.push(config);
  }
  return out;
}

const describeConfig = (c: GroupShareConfig): string =>
  SHARE_KEYS.filter((k) => c[k]).join("+") || "nothing";

// A day with every shareable value populated, so a masking bug shows up as a
// present field rather than an incidentally-empty one.
const RICH_SUMMARY: DaySummaryFacts = {
  entryDate: "2026-07-15",
  energyKcal: 1840.5,
  proteinG: 142.25,
  carbsG: 190.75,
  fatG: 61.5,
  mealsLogged: 3,
  mealNames: ["Oats", "Chicken Salad", "Salmon"],
  targetKcal: 2000,
  targetProteinG: 150,
  targetCarbsG: 200,
  targetFatG: 60,
  weightKg: 81.4,
};

const RICH_FACTS: MemberDayFacts = {
  userId: "00000000-0000-7000-8000-00000000000b",
  name: "Bob",
  image: null,
  date: "2026-07-15",
  summary: RICH_SUMMARY,
  weightTrend: { deltaKg: -0.8, direction: "down" },
  streak: 12,
};

const RICH_ENTRIES: DiaryEntryFacts[] = [
  {
    id: "00000000-0000-7000-8000-0000000000e1",
    meal: "breakfast",
    name: "Oats",
    loggedAt: new Date("2026-07-15T07:30:00.000Z"),
    servingLabel: "100 g",
    quantity: 100,
    unitLabel: "g",
    energyKcal: 380,
    proteinG: 13,
    carbsG: 67,
    fatG: 7,
  },
];

const NO_INTERACTIONS = { comments: [], reactions: [] };

/** Round-trips through JSON so "absent" means absent from the wire payload. */
function serialize(value: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

describe("member-day card masking", () => {
  // Which card fields each config may expose. adherenceOnly replaces every
  // numeric view with booleans, so it withholds more than the toggles alone.
  const expectations: Record<string, (c: GroupShareConfig) => boolean> = {
    calories: (c) => !c.adherenceOnly && c.calories,
    macros: (c) => !c.adherenceOnly && c.macros,
    mealsLogged: (c) => !c.adherenceOnly && c.mealNames,
    mealNames: (c) => c.mealNames,
    weightTrend: (c) => c.weightTrend,
    streak: (c) => c.streaks,
    adherence: (c) => c.adherenceOnly,
  };

  it.each(allConfigs().map((c) => [describeConfig(c), c] as const))(
    "exposes exactly the permitted fields for %s",
    (_label, config) => {
      const card = serialize(
        buildMemberDayCard(RICH_FACTS, config, NO_INTERACTIONS),
      );
      for (const [field, permitted] of Object.entries(expectations)) {
        if (permitted(config)) {
          expect(card, `${field} should be present`).toHaveProperty(field);
        } else {
          // Absent, not null: the key must never reach the payload.
          expect(
            Object.hasOwn(card, field),
            `${field} must be absent from the payload`,
          ).toBe(false);
        }
      }
    },
  );

  it("keeps the always-visible floor regardless of config", () => {
    const card = serialize(
      buildMemberDayCard(RICH_FACTS, SHARE_NOTHING, NO_INTERACTIONS),
    );
    // Identity + "did they log at all" are the group's reason to exist.
    expect(card).toMatchObject({ userId: RICH_FACTS.userId, logged: true });
    // …but nothing about what or how much.
    expect(Object.hasOwn(card, "calories")).toBe(false);
    expect(Object.hasOwn(card, "macros")).toBe(false);
    expect(Object.hasOwn(card, "mealNames")).toBe(false);
  });

  it("reports the effective config so clients can render locked chips", () => {
    const card = buildMemberDayCard(
      RICH_FACTS,
      { ...SHARE_NOTHING, calories: true },
      NO_INTERACTIONS,
    );
    expect(card.shared).toEqual({ ...SHARE_NOTHING, calories: true });
  });

  it("under-shares rather than over-shares on a malformed stored config", () => {
    for (const stored of [null, undefined, {}, "garbage", 42, { calories: "yes" }]) {
      expect(normalizeShareConfig(stored)).toEqual(SHARE_NOTHING);
    }
    // A partial stored blob keeps what it states and defaults the rest OFF.
    expect(normalizeShareConfig({ calories: true })).toEqual({
      ...SHARE_NOTHING,
      calories: true,
    });
  });
});

describe("diary entry masking (member-day detail)", () => {
  it.each(allConfigs().map((c) => [describeConfig(c), c] as const))(
    "exposes entries only with mealDetail, numbers only per toggle for %s",
    (_label, config) => {
      const masked = maskDiaryEntries(RICH_ENTRIES, config);
      if (!config.mealDetail) {
        // Undefined, so the controller omits the key entirely.
        expect(masked).toBeUndefined();
        return;
      }
      const entry = serialize(masked![0]);
      expect(Object.hasOwn(entry, "energyKcal")).toBe(
        !config.adherenceOnly && config.calories,
      );
      for (const macro of ["proteinG", "carbsG", "fatG"]) {
        expect(Object.hasOwn(entry, macro)).toBe(
          !config.adherenceOnly && config.macros,
        );
      }
      for (const portion of ["servingLabel", "quantity", "unitLabel"]) {
        expect(Object.hasOwn(entry, portion)).toBe(!config.adherenceOnly);
      }
    },
  );
});

describe("leaderboard masking", () => {
  const week = (summary: DaySummaryFacts | null) =>
    Array.from({ length: 7 }, (_, i) => ({
      date: `2026-07-${13 + i}`,
      summary,
    }));

  it.each(allConfigs().map((c) => [describeConfig(c), c] as const))(
    "never leaks raw nutrition or weight for %s",
    (_label, config) => {
      const entries = buildLeaderboardEntries([
        {
          userId: RICH_FACTS.userId,
          name: "Bob",
          image: null,
          rawConfig: config,
          days: week(RICH_SUMMARY),
          asOf: "2026-07-19",
          streak: 12,
        },
      ]);
      const json = JSON.stringify(entries);
      for (const banned of [
        "energyKcal",
        "consumedKcal",
        "proteinG",
        "carbsG",
        "fatG",
        "weightKg",
        "mealNames",
        "targetKcal",
      ]) {
        expect(json, `${banned} must not appear`).not.toContain(banned);
      }
      // Streak is the member's own toggle even in a ranking.
      expect(Object.hasOwn(serialize(entries[0]), "streak")).toBe(
        config.streaks,
      );
    },
  );

  it("ranks by adherence then days logged, never by calories", () => {
    const shares = { ...SHARE_NOTHING, calories: true };
    const perfect: DaySummaryFacts = { ...RICH_SUMMARY, energyKcal: 2000, proteinG: 150 };
    // "Heavy" eats far more but hits nothing; "Light" is on target.
    const entries = buildLeaderboardEntries([
      {
        userId: "heavy",
        name: "Heavy",
        image: null,
        rawConfig: shares,
        days: week({ ...RICH_SUMMARY, energyKcal: 5000, proteinG: 20 }),
        asOf: "2026-07-19",
        streak: 7,
      },
      {
        userId: "light",
        name: "Light",
        image: null,
        rawConfig: shares,
        days: week(perfect),
        asOf: "2026-07-19",
        streak: 7,
      },
    ]);
    expect(entries[0].userId).toBe("light");
    expect(entries[1].userId).toBe("heavy");
  });

  it("reports no adherence for a member sharing none of it", () => {
    const [entry] = buildLeaderboardEntries([
      {
        userId: RICH_FACTS.userId,
        name: "Bob",
        image: null,
        rawConfig: { ...SHARE_NOTHING, mealNames: true },
        days: week(RICH_SUMMARY),
        asOf: "2026-07-19",
        streak: 3,
      },
    ]);
    expect(entry.adherencePct).toBeNull();
  });
});

describe("adherenceOnly leaks no numbers", () => {
  /** Every number in the payload, with the path it sits at. */
  function collectNumbers(
    node: unknown,
    path = "",
    found: [string, number][] = [],
  ): [string, number][] {
    if (typeof node === "number") {
      found.push([path, node]);
    } else if (Array.isArray(node)) {
      node.forEach((v, i) => collectNumbers(v, `${path}[${i}]`, found));
    } else if (node !== null && typeof node === "object") {
      for (const [k, v] of Object.entries(node)) {
        collectNumbers(v, path ? `${path}.${k}` : k, found);
      }
    }
    return found;
  }

  const adherenceOnlyConfigs = allConfigs().filter((c) => c.adherenceOnly);

  it.each(adherenceOnlyConfigs.map((c) => [describeConfig(c), c] as const))(
    "card and entries carry no numerics for %s",
    (_label, config) => {
      const card = serialize(
        buildMemberDayCard(RICH_FACTS, config, NO_INTERACTIONS),
      );
      const entries = maskDiaryEntries(RICH_ENTRIES, config);
      // The streak day-count is the one permitted number: it's gamification
      // the member opted into, not nutrition data.
      const allowed = new Set(["streak"]);
      const leaked = [
        ...collectNumbers(card, "card"),
        ...collectNumbers(entries ?? [], "entries"),
      ].filter(([path]) => !allowed.has(path.split(".").pop() ?? ""));
      expect(leaked, `numerics leaked: ${JSON.stringify(leaked)}`).toEqual([]);
    },
  );

  it("returns booleans against targets instead of values", () => {
    const card = buildMemberDayCard(
      RICH_FACTS,
      { ...SHARE_NOTHING, adherenceOnly: true },
      NO_INTERACTIONS,
    );
    expect(card.adherence).toEqual({
      logged: true,
      caloriesInRange: true, // 1840.5 is within 10% of 2000
      proteinHit: true, // 142.25 clears the 90% floor of 150
      carbsInRange: true, // 190.75 is under the 220 cap
      fatInRange: true, // 61.5 is under the 66 cap
    });
  });

  it("drops the weight delta but may keep the direction", () => {
    const card = buildMemberDayCard(
      RICH_FACTS,
      { ...SHARE_NOTHING, adherenceOnly: true, weightTrend: true },
      NO_INTERACTIONS,
    );
    expect(card.weightTrend).toEqual({ direction: "down" });
    expect(Object.hasOwn(card.weightTrend!, "deltaKg")).toBe(false);
  });
});

describe("left and removed members", () => {
  it("scopes group member reads to active status", () => {
    // Offline drizzle instance: postgres-js connects lazily, so building the
    // query never opens a socket.
    const db = drizzle(postgres("postgres://user:pw@127.0.0.1:5432/unused"), {
      schema,
    });
    const { sql, params } = activeMembersQuery(
      db,
      "00000000-0000-7000-8000-00000000000f",
    ).toSQL();

    expect(sql).toMatch(/"status"\s*=\s*\$\d/);
    expect(params).toContain("active");
    // Never widen this to include historical rows.
    for (const status of ["left", "removed", "invited"]) {
      expect(params).not.toContain(status);
    }
  });
});

describe("share config patches", () => {
  it("applies only the keys the caller named", () => {
    // Regression: a patch schema built with per-field .default(false) would
    // materialize every absent key and silently switch it off.
    const patch = groupSharePatchSchema.parse({ calories: true });
    expect(Object.keys(patch)).toEqual(["calories"]);

    const merged = { ...CATEGORY_SHARE_DEFAULTS.friends, ...patch };
    expect(merged).toEqual({
      ...CATEGORY_SHARE_DEFAULTS.friends,
      calories: true,
    });
    // The friends defaults that the caller never mentioned survive.
    expect(merged.macros).toBe(true);
    expect(merged.streaks).toBe(true);
  });

  it.each(SHARE_KEYS)("patching %s leaves the other keys untouched", (key) => {
    const baseline = CATEGORY_SHARE_DEFAULTS.partner;
    const patch = groupSharePatchSchema.parse({ [key]: !baseline[key] });
    const merged = { ...baseline, ...patch };
    for (const other of SHARE_KEYS) {
      if (other === key) {
        expect(merged[other]).toBe(!baseline[other]);
      } else {
        expect(merged[other], `${other} changed`).toBe(baseline[other]);
      }
    }
  });

  it("normalizes a stored config by defaulting absent keys OFF", () => {
    expect(groupShareConfigSchema.parse({})).toEqual(SHARE_NOTHING);
    expect(groupShareConfigSchema.parse({ streaks: true })).toEqual({
      ...SHARE_NOTHING,
      streaks: true,
    });
  });

  it("gives trainer clients everything and coaches nothing", () => {
    expect(CATEGORY_SHARE_DEFAULTS.trainer).toEqual({
      adherenceOnly: false,
      calories: true,
      macros: true,
      mealNames: true,
      mealDetail: true,
      weightTrend: true,
      streaks: true,
    });
  });
});

describe("adherence windows", () => {
  const onTarget: DaySummaryFacts = {
    ...RICH_SUMMARY,
    energyKcal: 2000,
    proteinG: 150,
    carbsG: 200,
    fatG: 60,
  };
  const weekDays = (
    logged: Record<string, DaySummaryFacts>,
  ): { date: string; summary: DaySummaryFacts | null }[] =>
    Array.from({ length: 7 }, (_, i) => {
      const date = `2026-07-${String(13 + i).padStart(2, "0")}`;
      return { date, summary: logged[date] ?? null };
    });

  it("scores an unlogged past day as a miss", () => {
    // One perfect day out of seven elapsed is 1/7, not 100%.
    const pct = windowAdherencePct(
      weekDays({ "2026-07-13": { ...onTarget, entryDate: "2026-07-13" } }),
      "2026-07-19",
    );
    expect(pct).toBe(14);
  });

  it("does not charge days that have not happened yet", () => {
    // Same single logged day, but it is only Monday: 1/1 elapsed.
    const pct = windowAdherencePct(
      weekDays({ "2026-07-13": { ...onTarget, entryDate: "2026-07-13" } }),
      "2026-07-13",
    );
    expect(pct).toBe(100);
  });

  it("charges each member only for their own elapsed days", () => {
    // Mid-week, 01:00Z on the 16th is still the 15th in New York but already
    // the 16th in Berlin, so the same week has a different number of elapsed
    // days per member — which is why asOf is per member, not per request.
    const instant = new Date("2026-07-16T01:00:00.000Z");
    const newYork = localDateFor("America/New_York", instant);
    const berlin = localDateFor("Europe/Berlin", instant);
    expect(newYork).toBe("2026-07-15");
    expect(berlin).toBe("2026-07-16");

    const days = weekDays({ "2026-07-13": { ...onTarget, entryDate: "2026-07-13" } });
    expect(windowAdherencePct(days, newYork)).toBe(33); // 1 hit / 3 elapsed
    expect(windowAdherencePct(days, berlin)).toBe(25); // 1 hit / 4 elapsed
  });

  it("returns null when no elapsed day had targets to score", () => {
    expect(windowAdherencePct(weekDays({}), "2026-07-19")).toBeNull();
    const noTargets: DaySummaryFacts = {
      ...onTarget,
      targetKcal: null,
      targetProteinG: null,
      targetCarbsG: null,
      targetFatG: null,
    };
    expect(
      windowAdherencePct(
        weekDays({ "2026-07-13": { ...noTargets, entryDate: "2026-07-13" } }),
        "2026-07-19",
      ),
    ).toBeNull();
  });

  it("falls back to an unknown timezone instead of failing the read", () => {
    const instant = new Date("2026-07-20T01:00:00.000Z");
    expect(localDateFor("Not/AZone", instant)).toBe("2026-07-20");
  });
});
