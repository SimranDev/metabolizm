import * as schema from "@metabolizm/db";
import { drizzle, PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

export type Database = PostgresJsDatabase<typeof schema> & {
  $client: postgres.Sql;
};

export function createDb(url: string, options?: { max?: number }): Database {
  const client = postgres(url, options);
  return drizzle(client, { schema });
}

/** Where a connection string points, for the sync tab's "am I about to write prod?" banner. */
export type DbIdentity = {
  host: string;
  port: number;
  database: string;
  user: string;
  /** Whether the host is a local one — the only kind sync will WRITE to. */
  loopback: boolean;
};

const LOOPBACK_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "0.0.0.0",
  "host.docker.internal",
]);

export function describeConnection(url: string): DbIdentity {
  const parsed = new URL(url);
  // URL keeps IPv6 literals bracketed; the set above stores them bare.
  const host = parsed.hostname.replace(/^\[|\]$/g, "");
  return {
    host,
    port: parsed.port ? Number(parsed.port) : 5432,
    database: decodeURIComponent(parsed.pathname.replace(/^\//, "")) || "postgres",
    user: decodeURIComponent(parsed.username),
    loopback: LOOPBACK_HOSTS.has(host),
  };
}

/** Same server AND same database — a sync between these would be a no-op onto itself. */
export function sameDatabase(a: DbIdentity, b: DbIdentity): boolean {
  return a.host === b.host && a.port === b.port && a.database === b.database;
}

// drizzle wraps driver errors (DrizzleQueryError with the PostgresError as
// its cause), so walk the cause chain instead of checking the top level.
export function findPgError(error: unknown): postgres.PostgresError | null {
  let current: unknown = error;
  while (current instanceof Error) {
    if (current instanceof postgres.PostgresError) return current;
    current = current.cause;
  }
  return null;
}

export function isPgError(error: unknown, code: string): boolean {
  return findPgError(error)?.code === code;
}
