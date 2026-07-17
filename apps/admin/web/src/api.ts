/**
 * Thin fetch client for the admin Fastify server (proxied under /api).
 */
import type { FoodDto } from "@metabolizm/shared";

export type FoodListRow = {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  baseUnit: "g" | "ml";
  energyKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  isVerified: boolean;
  updatedAt: string;
};

export type ParsedFood = {
  name: string;
  brand?: string;
  description?: string;
  barcode?: string;
  /** Import provenance (e.g. "fdc:2262074"); carried into the create payload. */
  sourceRef?: string | null;
  baseUnit?: "g" | "ml";
  servingSize?: number;
  servingLabel?: string;
  energyKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  nutrients?: Record<string, number>;
  portions?: {
    label: string;
    quantity?: number;
    amountInBase: number;
    isDefault?: boolean;
  }[];
};

export type ParseResponse = { food: ParsedFood; warnings: string[] };

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "content-type": "application/json" },
    ...init,
  });
  if (res.status === 204) return undefined as T;
  const body: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const record = (body ?? {}) as Record<string, unknown>;
    const message =
      typeof record.message === "string"
        ? record.message
        : `Request failed (${res.status})`;
    throw new ApiError(res.status, message);
  }
  return body as T;
}

export const api = {
  parse: (text: string) =>
    request<ParseResponse>("/api/parse", {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
  createFood: (payload: unknown) =>
    request<FoodDto>("/api/foods", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  listFoods: (q: string) =>
    request<{ items: FoodListRow[] }>(
      `/api/foods?${new URLSearchParams(q ? { q } : {}).toString()}`,
    ),
  getFood: (id: string) => request<FoodDto>(`/api/foods/${id}`),
  updateFood: (id: string, payload: unknown) =>
    request<FoodDto>(`/api/foods/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteFood: (id: string) =>
    request<void>(`/api/foods/${id}`, { method: "DELETE" }),
};
