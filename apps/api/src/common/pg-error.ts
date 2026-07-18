import postgres from "postgres";

// drizzle wraps driver errors (DrizzleQueryError with the PostgresError as
// its cause), so walk the cause chain instead of checking the top level.
export function isPgError(error: unknown, code: string): boolean {
  let current: unknown = error;
  while (current instanceof Error) {
    if (current instanceof postgres.PostgresError) return current.code === code;
    current = current.cause;
  }
  return false;
}
