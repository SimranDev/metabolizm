import * as schema from "@metabolizm/db";
import { drizzle, PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

export type Database = PostgresJsDatabase<typeof schema> & {
  $client: postgres.Sql;
};

export function createDb(url: string): Database {
  const client = postgres(url);
  return drizzle(client, { schema });
}

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
