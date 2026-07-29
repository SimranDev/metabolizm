import type { FoodDto, FoodSearchResponse } from "@metabolizm/shared";
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

import {
  createFoodReportSchema,
  type CreateFoodReportInput,
} from "@metabolizm/shared";

import { CallerContext } from "../common/caller-context";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import {
  createFoodSchema,
  foodIdParamSchema,
  listFoodsQuerySchema,
  updateFoodSchema,
  type CreateFoodInput,
  type ListFoodsQuery,
  type UpdateFoodInput,
} from "./catalog.schemas";
import { CatalogService } from "./catalog.service";

@Controller("catalog")
export class CatalogController {
  constructor(
    private readonly catalogService: CatalogService,
    private readonly caller: CallerContext,
  ) {}

  @Post("foods")
  createFood(
    @Body(new ZodValidationPipe(createFoodSchema)) body: CreateFoodInput,
  ): Promise<FoodDto> {
    return this.catalogService.createFood(this.caller.requireUserId(), body);
  }

  @Get("foods")
  listFoods(
    @Query(new ZodValidationPipe(listFoodsQuerySchema)) query: ListFoodsQuery,
  ): Promise<FoodSearchResponse> {
    return this.catalogService.listFoods(this.caller.userId, query);
  }

  /**
   * Barcode lookup. Declared BEFORE `foods/:id` — Nest matches routes in
   * declaration order, and "by-barcode" would otherwise be swallowed as an id.
   * 404 not found, 422 store-local; the client renders all three differently.
   */
  @Get("foods/by-barcode/:code")
  getFoodByBarcode(@Param("code") code: string): Promise<FoodDto> {
    return this.catalogService.getFoodByBarcode(this.caller.userId, code);
  }

  @Get("foods/:id")
  getFood(
    @Param("id", new ZodValidationPipe(foodIdParamSchema)) id: string,
  ): Promise<FoodDto> {
    return this.catalogService.getFood(this.caller.userId, id);
  }

  @Patch("foods/:id")
  updateFood(
    @Param("id", new ZodValidationPipe(foodIdParamSchema)) id: string,
    @Body(new ZodValidationPipe(updateFoodSchema)) body: UpdateFoodInput,
  ): Promise<FoodDto> {
    return this.catalogService.updateFood(
      this.caller.requireUserId(),
      id,
      body,
    );
  }

  @Delete("foods/:id")
  @HttpCode(204)
  async deleteFood(
    @Param("id", new ZodValidationPipe(foodIdParamSchema)) id: string,
  ): Promise<void> {
    await this.catalogService.deleteFood(this.caller.requireUserId(), id);
  }

  /** "This food looks wrong." Requeues an approved food for review. */
  @Post("foods/:id/reports")
  @HttpCode(201)
  async reportFood(
    @Param("id", new ZodValidationPipe(foodIdParamSchema)) id: string,
    @Body(new ZodValidationPipe(createFoodReportSchema))
    body: CreateFoodReportInput,
  ): Promise<void> {
    await this.catalogService.reportFood(
      this.caller.requireUserId(),
      id,
      body.reason,
    );
  }
}
