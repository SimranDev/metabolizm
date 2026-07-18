import {
  Inject,
  Injectable,
  Scope,
  UnauthorizedException,
} from "@nestjs/common";
import { REQUEST } from "@nestjs/core";
import { z } from "zod";

// Structural type instead of FastifyRequest: fastify is a transitive dep of
// @nestjs/platform-fastify and not resolvable under pnpm isolated linking.
// `authUserId` is stashed by SessionGuard (apps/api/src/auth/session.guard.ts).
type IncomingRequest = {
  headers: Record<string, string | string[] | undefined>;
  authUserId?: string | null;
};

const userIdSchema = z.uuid();

/**
 * Caller identity. The Better Auth session (resolved by the global
 * SessionGuard) wins; outside production the `x-user-id` header still works
 * as a dev/testing fallback. Consumers only depend on `userId` /
 * `requireUserId()`.
 */
@Injectable({ scope: Scope.REQUEST })
export class CallerContext {
  constructor(@Inject(REQUEST) private readonly request: IncomingRequest) {}

  /** Caller user id, or null when anonymous. Malformed dev header → 401. */
  get userId(): string | null {
    const sessionUserId = this.request.authUserId;
    if (sessionUserId) return sessionUserId;
    if (process.env.NODE_ENV === "production") return null;
    const raw = this.request.headers["x-user-id"];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value === undefined || value === "") return null;
    const parsed = userIdSchema.safeParse(value);
    if (!parsed.success) {
      throw new UnauthorizedException("x-user-id must be a UUID");
    }
    return parsed.data;
  }

  requireUserId(): string {
    const id = this.userId;
    if (id === null) {
      throw new UnauthorizedException("Authentication required");
    }
    return id;
  }
}
