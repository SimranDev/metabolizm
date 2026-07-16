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
    new FastifyAdapter(),
  );
  app.setGlobalPrefix("v1");
  app.enableShutdownHooks();

  const config = app.get(ConfigService);
  const port = config.get<number>("PORT") ?? 3000;
  // 0.0.0.0 so the port is reachable from outside a container.
  await app.listen(port, "0.0.0.0");
}

void bootstrap();
