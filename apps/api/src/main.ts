import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";

import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    // trustProxy: in production the service sits behind a TLS-terminating
    // edge (Railway), so the socket is plain http from the proxy's IP. Without
    // this, `request.protocol` reports http and `request.ip` is the proxy for
    // every caller. Better Auth is unaffected (it builds URLs from the
    // configured BETTER_AUTH_URL, not the request), but anything added later
    // that reads either — rate limiting, logging, redirects — would be wrong.
    new FastifyAdapter({ trustProxy: true }),
  );
  app.setGlobalPrefix("v1");
  app.enableShutdownHooks();

  const config = app.get(ConfigService);
  const port = config.get<number>("PORT") ?? 3000;
  // 0.0.0.0 so the port is reachable from outside a container.
  await app.listen(port, "0.0.0.0");
}

void bootstrap();
