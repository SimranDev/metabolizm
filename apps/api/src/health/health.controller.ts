import type { HealthResponse } from "@metabolizm/shared";
import { Controller, Get } from "@nestjs/common";

import { APP_VERSION } from "../version";

@Controller("health")
export class HealthController {
  @Get()
  getHealth(): HealthResponse {
    return {
      status: "ok",
      version: APP_VERSION,
      timestamp: new Date().toISOString(),
    };
  }
}
