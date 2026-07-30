/**
 * Thin fetch client for the admin Fastify server (proxied under /api).
 */
import type {
  FoodDto,
  FoodFlag,
  FoodReviewStatus,
} from "@metabolizm/shared";

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

/** A row in the review queue (user foods only — see server/review.ts). */
export type ReviewQueueRow = {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  baseUnit: "g" | "ml";
  energyKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  reviewStatus: FoodReviewStatus;
  reviewFlags: FoodFlag[];
  createdAt: string;
  ownerEmail: string | null;
  openReports: number;
  /** 4·P + 4·C + 9·F — the energy the macros themselves imply. */
  computedKcal: number;
  /** entered − computed. The number that resolves most of the queue. */
  kcalDelta: number;
  maxSeverity: "high" | "medium" | "low" | null;
};

export type ReviewReport = {
  id: string;
  reason: string;
  reporterEmail: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

export type ReviewHistoryRow = {
  id: string;
  foodVersion: number;
  fromStatus: FoodReviewStatus;
  toStatus: FoodReviewStatus;
  note: string | null;
  reviewerEmail: string | null;
  createdAt: string;
};

export type ReviewDetail = {
  food: FoodDto;
  ownerEmail: string | null;
  computedKcal: number;
  reports: ReviewReport[];
  history: ReviewHistoryRow[];
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

// Sync tab — live → local. Mirrors the types in server/sync.ts and
// server/sync-plan.ts (web/tsconfig.json only includes web/src, so these are
// declared here rather than imported, same as the food rows above).
export type DbIdentity = {
  host: string;
  port: number;
  database: string;
  user: string;
  loopback: boolean;
};

export type SyncStatus = {
  configured: boolean;
  ready: boolean;
  reason: string | null;
  source: DbIdentity | null;
  target: DbIdentity;
};

export type SyncUserRow = {
  id: string;
  email: string;
  name: string;
  timezone: string;
  region: string;
  createdAt: string;
  live: {
    diaryEntries: number;
    weightEntries: number;
    groups: number;
    foods: number;
  };
  /** null when the account does not exist locally at all. */
  local: { diaryEntries: number; weightEntries: number } | null;
};

export type ColumnChange = { column: string; from: string; to: string };
export type RowChange = { label: string; changes: ColumnChange[] };

export type TablePlan = {
  table: string;
  insert: number;
  update: number;
  unchanged: number;
  skipped: number;
  localOnly: number;
  pruned: number;
  prunable: boolean;
  changedColumns: Record<string, number>;
  samples: { inserts: string[]; updates: RowChange[]; localOnly: string[] };
};

export type SyncPlan = {
  applied: boolean;
  pruneRequested: boolean;
  users: {
    id: string;
    email: string;
    name: string;
    role: "selected" | "dependency";
  }[];
  tables: TablePlan[];
  totals: {
    insert: number;
    update: number;
    unchanged: number;
    localOnly: number;
    pruned: number;
  };
  blockers: { table: string; message: string }[];
  warnings: string[];
};

export type SyncRequest = {
  userIds: string[];
  includeGroups: boolean;
  prune: boolean;
};

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

  // Review queue — user foods. Separate route prefix from the system-catalog
  // calls above, mirroring the server-side split.
  reviewQueue: (params: {
    status: FoodReviewStatus;
    flag?: string;
    severity?: string;
  }) => {
    const q = new URLSearchParams({ status: params.status });
    if (params.flag) q.set("flag", params.flag);
    if (params.severity) q.set("severity", params.severity);
    return request<{ items: ReviewQueueRow[] }>(`/api/review/queue?${q}`);
  },
  reviewFood: (id: string) => request<ReviewDetail>(`/api/review/foods/${id}`),
  correctReviewFood: (id: string, payload: unknown) =>
    request<FoodDto>(`/api/review/foods/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  reviewDecision: (id: string, status: FoodReviewStatus, note?: string) =>
    request<FoodDto>(`/api/review/foods/${id}/decision`, {
      method: "POST",
      body: JSON.stringify({ status, note }),
    }),
  resolveReport: (id: string) =>
    request<{ id: string }>(`/api/review/reports/${id}/resolve`, {
      method: "POST",
    }),

  // Sync — the live database is read-only here; only the local one is written.
  syncStatus: () => request<SyncStatus>("/api/sync/status"),
  syncUsers: (q: string) =>
    request<{ items: SyncUserRow[] }>(
      `/api/sync/users?${new URLSearchParams(q ? { q } : {}).toString()}`,
    ),
  syncPlan: (body: SyncRequest) =>
    request<SyncPlan>("/api/sync/plan", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  syncApply: (body: SyncRequest) =>
    request<SyncPlan>("/api/sync/apply", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
