/**
 * Catalog-hygiene rules shared by scripts/cleanup-usda-names.ts (one-off
 * data fix for the live DB) and the USDA mapper (import time), so a fresh
 * seed and the cleaned DB agree on names and portion labels.
 */

/**
 * USDA suffix boilerplate, e.g. "Cheese, cheddar (Includes foods for USDA's
 * Food Distribution Program)". Tolerates the curly apostrophe variant.
 */
const NAME_BOILERPLATE =
  /\s*\(Includes foods for USDA['’]s Food Distribution Program\)/gi;

export function cleanFoodName(name: string): string {
  return name.replace(NAME_BOILERPLATE, "").replace(/\s{2,}/g, " ").trim();
}

// "NLEA serving" / "RACC" are US labeling-regulation jargon leaking out of
// FDC portionDescription texts. Observed shapes, in the order the rules
// below fire: leading ("1 NLEA serving (makes 1/2 cup prepared)"),
// parenthetical with a real remainder ("1 serving (1 NLEA serving - about
// 4 crackers)"), pure parenthetical ("1 tbsp (1 NLEA serving)", "0.33 cup
// (NLEA serving size)"), trailing ("2 links 1 NLEA serving"), and a bare
// trailing ", NLEA".
const JARGON = "(?:NLEA serving|RACC)";
const LEADING = new RegExp(`^1\\s+${JARGON}\\b`, "i");
const PAREN_WITH_REMAINDER = new RegExp(
  `\\((?:1\\s+)?${JARGON}\\s*[-–—]\\s*`,
  "gi",
);
const PAREN_ONLY = new RegExp(
  `\\s*\\(\\s*(?:1\\s+)?${JARGON}(?:\\s+size)?\\s*\\)`,
  "gi",
);
const TRAILING = new RegExp(`\\s*,?\\s*(?:1\\s+)?${JARGON}$`, "i");
const TRAILING_BARE = /\s*,\s*(?:NLEA|RACC)$/i;

export function cleanPortionLabel(label: string): string {
  const cleaned = label
    .replace(LEADING, "1 serving")
    .replace(PAREN_WITH_REMAINDER, "(")
    .replace(PAREN_ONLY, "")
    .replace(TRAILING, "")
    .replace(TRAILING_BARE, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return cleaned === "" ? "1 serving" : cleaned;
}
