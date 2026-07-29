/**
 * Barcode normalisation. Pure and dependency-free, like nutrients.ts and
 * food-review.ts, because api, admin and mobile all need the identical answer.
 *
 * Every barcode is stored as **GTIN-14, zero-left-padded**. UPC-A (12), EAN-13
 * and EAN-8 all collapse to one comparable form, which removes the single most
 * common cause of a false "product not in database": a US product scans as 12
 * digits while the database holds 13, and the lookup misses a record that is
 * sitting right there.
 */

export type GtinResult =
  | { kind: "gtin"; value: string }
  /**
   * GS1 restricted-circulation ranges. The digits encode a weight or a price
   * set by the store's own scales, not a globally identified product, so these
   * can NEVER resolve against any database however complete it gets. Detecting
   * them lets the UI say "this is a store label, enter the food manually"
   * instead of a generic not-found, which a user would otherwise answer by
   * rescanning the same label repeatedly.
   */
  | { kind: "store_local" }
  | { kind: "invalid"; reason: "empty" | "length" | "check_digit" };

/** Lengths GS1 defines. Anything else is a misread or not a GTIN at all. */
const VALID_LENGTHS = new Set([8, 12, 13, 14]);

/**
 * GS1 mod-10. Weights alternate 3,1,3,1… from the digit immediately left of
 * the check digit, so they depend on position-from-the-right and work for
 * every GTIN length without special-casing.
 */
export function gtinCheckDigit(digitsWithoutCheck: string): number {
  let sum = 0;
  for (let i = digitsWithoutCheck.length - 1, weight = 3; i >= 0; i--, weight = weight === 3 ? 1 : 3) {
    sum += Number(digitsWithoutCheck[i]) * weight;
  }
  return (10 - (sum % 10)) % 10;
}

/**
 * True for GS1 restricted-circulation / variable-measure ranges, judged on the
 * code AS SCANNED — the prefix means different things at different lengths, so
 * this must run before zero-padding, which would otherwise shift it.
 */
function isRestrictedCirculation(code: string): boolean {
  switch (code.length) {
    // EAN-8: prefixes 0 and 2 are restricted.
    case 8:
      return code[0] === "0" || code[0] === "2";
    // UPC-A: number system 2 is variable-weight (in-store priced). A leading
    // 0 here is an ordinary product, NOT restricted — most US UPCs start 0.
    case 12:
      return code[0] === "2";
    // EAN-13 / ITF-14: prefixes 02 and 20–29. On a 14-digit code the first
    // digit is the packaging indicator, so the prefix starts one place in.
    case 13:
      return code.startsWith("02") || /^2[0-9]/.test(code);
    case 14:
      return code.slice(1).startsWith("02") || /^2[0-9]/.test(code.slice(1));
    default:
      return false;
  }
}

/**
 * Normalise a scanned or typed barcode to storage form.
 *
 * The check digit is validated BEFORE the restricted-range test on purpose: a
 * failed check digit means the code was misread, so claiming anything about
 * what kind of code it is would be a guess.
 */
export function normalizeGtin(raw: string): GtinResult {
  // Scanners and hand entry both bring spaces, hyphens and stray whitespace.
  const code = raw.replace(/\D/g, "");
  if (code.length === 0) return { kind: "invalid", reason: "empty" };
  if (!VALID_LENGTHS.has(code.length)) {
    return { kind: "invalid", reason: "length" };
  }

  const body = code.slice(0, -1);
  const check = Number(code[code.length - 1]);
  if (gtinCheckDigit(body) !== check) {
    return { kind: "invalid", reason: "check_digit" };
  }

  if (isRestrictedCirculation(code)) return { kind: "store_local" };

  return { kind: "gtin", value: code.padStart(14, "0") };
}

/** Display form — trims the padding back off for a human-readable barcode. */
export function formatGtin(gtin14: string): string {
  return gtin14.replace(/^0+(?=\d{8})/, "");
}
