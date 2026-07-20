/** Calendar-day helpers for group reads. All dates are YYYY-MM-DD strings. */

const DAY_MS = 86_400_000;

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timezone: string): Intl.DateTimeFormat {
  let fmt = formatters.get(timezone);
  if (!fmt) {
    // en-CA formats as YYYY-MM-DD.
    fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    formatters.set(timezone, fmt);
  }
  return fmt;
}

/**
 * The current calendar day in an IANA timezone — each member's own "today"
 * for feed reads. Unknown/garbage timezones fall back to UTC instead of
 * failing the whole group read.
 */
export function localDateFor(timezone: string, now: Date = new Date()): string {
  try {
    return formatterFor(timezone).format(now);
  } catch {
    return formatterFor("UTC").format(now);
  }
}

export function addDays(date: string, days: number): string {
  const t = Date.parse(`${date}T00:00:00Z`) + days * DAY_MS;
  return new Date(t).toISOString().slice(0, 10);
}

/** Monday of the ISO week containing the date. */
export function weekStartOf(date: string): string {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(date, -((dow + 6) % 7));
}

/** `count` consecutive days starting at `start`, oldest first. */
export function dateRange(start: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(start, i));
}

export function maxDate(dates: Iterable<string>): string {
  let max = "";
  for (const d of dates) if (d > max) max = d;
  return max;
}

export function minDate(dates: Iterable<string>): string {
  let min = "9999-12-31";
  for (const d of dates) if (d < min) min = d;
  return min;
}
