import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from "@nestjs/common";
import { fromNodeHeaders } from "better-auth/node";

import { AUTH, type Auth } from "./auth.instance";

// Structural request type: fastify isn't resolvable under pnpm isolated
// linking (see common/caller-context.ts). `authUserId` is stashed here for
// CallerContext to read synchronously.
type GuardedRequest = {
  headers: Record<string, string | string[] | undefined>;
  authUserId?: string | null;
};

/**
 * Global guard that resolves the Better Auth session and stashes the user id
 * on the request. It never rejects — anonymous requests stay allowed (public
 * catalog reads, /v1/health); rejection lives in CallerContext.requireUserId().
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(AUTH) private readonly auth: Auth) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<GuardedRequest>();
    request.authUserId = null;
    // Fast path: no cookie, no session lookup.
    if (!request.headers.cookie) return true;
    const session = await this.auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });
    request.authUserId = session?.user.id ?? null;
    return true;
  }
}
