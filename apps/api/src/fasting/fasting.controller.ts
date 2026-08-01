import type {
  FastingCurrentResponse,
  FastingSessionResponse,
  FastingSessionsResponse,
} from "@metabolizm/shared";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";

import { CallerContext } from "../common/caller-context";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import {
  endFastSchema,
  fastingSessionIdParamSchema,
  fastingSessionsQuerySchema,
  startFastSchema,
  type EndFastInput,
  type FastingSessionsQuery,
  type StartFastInput,
} from "./fasting.schemas";
import { FastingService } from "./fasting.service";

@Controller("fasting")
export class FastingController {
  constructor(
    private readonly fastingService: FastingService,
    private readonly caller: CallerContext,
  ) {}

  /** The open fast, or `{ session: null }` — an absence, not a 404. */
  @Get("current")
  async current(): Promise<FastingCurrentResponse> {
    return {
      session: await this.fastingService.current(this.caller.requireUserId()),
    };
  }

  @Post("sessions")
  async start(
    @Body(new ZodValidationPipe(startFastSchema)) body: StartFastInput,
  ): Promise<FastingSessionResponse> {
    return {
      session: await this.fastingService.start(this.caller.requireUserId(), body),
    };
  }

  @Get("sessions")
  async list(
    @Query(new ZodValidationPipe(fastingSessionsQuerySchema))
    query: FastingSessionsQuery,
  ): Promise<FastingSessionsResponse> {
    return this.fastingService.list(this.caller.requireUserId(), query);
  }

  /** Sending `endedAt` is what ends a fast; see FastingService.patch. */
  @Patch("sessions/:id")
  async patch(
    @Param("id", new ZodValidationPipe(fastingSessionIdParamSchema)) id: string,
    @Body(new ZodValidationPipe(endFastSchema)) body: EndFastInput,
  ): Promise<FastingSessionResponse> {
    return {
      session: await this.fastingService.patch(
        this.caller.requireUserId(),
        id,
        body,
      ),
    };
  }

  @Delete("sessions/:id")
  @HttpCode(204)
  async remove(
    @Param("id", new ZodValidationPipe(fastingSessionIdParamSchema)) id: string,
  ): Promise<void> {
    await this.fastingService.remove(this.caller.requireUserId(), id);
  }
}
