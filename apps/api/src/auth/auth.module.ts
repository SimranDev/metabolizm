import { Inject, Module, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD, HttpAdapterHost } from "@nestjs/core";

import { DB } from "../db/db.module";
import { AUTH, createAuth, type Auth } from "./auth.instance";
import { SessionGuard } from "./session.guard";

// Structural fastify types: fastify is a transitive dep of
// @nestjs/platform-fastify and not resolvable under pnpm isolated linking
// (same reason as common/caller-context.ts).
type RawRequest = {
  url: string;
  method: string;
  body: unknown;
  headers: Record<string, string | string[] | undefined>;
};
type RawReply = {
  status(code: number): RawReply;
  header(key: string, value: string | string[]): RawReply;
  send(payload?: string | null): void;
};
type FastifyLike = {
  route(opts: {
    method: string[];
    url: string;
    handler: (req: RawRequest, reply: RawReply) => Promise<void>;
  }): void;
};

@Module({
  providers: [
    { provide: AUTH, inject: [DB, ConfigService], useFactory: createAuth },
    { provide: APP_GUARD, useClass: SessionGuard },
  ],
  exports: [AUTH],
})
export class AuthModule implements OnModuleInit {
  constructor(
    @Inject(AUTH) private readonly auth: Auth,
    private readonly host: HttpAdapterHost,
  ) {}

  // Mount Better Auth as a raw Fastify catch-all. Raw routes bypass Nest's
  // global prefix (so /v1 is spelled out) and all guards/pipes. onModuleInit
  // runs during app.init(), before the adapter starts listening — routes
  // cannot be added after that.
  onModuleInit(): void {
    const fastify = this.host.httpAdapter.getInstance<FastifyLike>();
    fastify.route({
      method: ["GET", "POST"],
      url: "/v1/auth/*",
      handler: async (req, reply) => {
        const url = new URL(req.url, `http://${String(req.headers.host ?? "localhost")}`);
        const headers = new Headers();
        for (const [key, value] of Object.entries(req.headers)) {
          // The body below is re-serialized; a stale content-length would lie.
          if (value === undefined || key === "content-length") continue;
          headers.append(key, Array.isArray(value) ? value.join(",") : value);
        }
        const response = await this.auth.handler(
          new Request(url, {
            method: req.method,
            headers,
            // Fastify already parsed the JSON body — re-serialize it.
            body: req.body ? JSON.stringify(req.body) : undefined,
          }),
        );
        reply.status(response.status);
        response.headers.forEach((value, key) => {
          if (key !== "set-cookie") reply.header(key, value);
        });
        // Headers.forEach flattens multiple Set-Cookie headers into one
        // comma-joined value — forward them individually instead.
        const cookies = response.headers.getSetCookie();
        if (cookies.length > 0) reply.header("set-cookie", cookies);
        reply.send(response.body ? await response.text() : null);
      },
    });
  }
}
