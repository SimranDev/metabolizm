/**
 * Catalog review queue. Unlike the Add/Browse tabs, everything here is a USER
 * food (see server/review.ts) — public and already live. Approving does not
 * publish anything; it decides whether the row ranks as approved and wears a
 * verified badge.
 */
import { useCallback, useEffect, useState } from "react";

import { api, ApiError, type ReviewDetail, type ReviewQueueRow } from "./api";
import { draftFromDto, toUpdatePayload, type FoodDraft } from "./draft";
import { FoodForm } from "./food-form";

import type { FoodFlag, FoodReviewStatus } from "@metabolizm/shared";

const STATUSES: FoodReviewStatus[] = [
  "pending",
  "needs_edit",
  "approved",
  "rejected",
];

const FLAG_LABELS: Record<string, string> = {
  energy_unit_confusion: "kJ entered as kcal",
  atwater_mismatch: "energy ≠ macros",
  macros_exceed_base: "macros > base",
  implausible_energy: "energy too high",
  all_zero: "all zero",
  no_portions: "no portions",
  suspicious_text: "suspicious name",
  duplicate_name_brand: "possible duplicate",
  first_record_for_gtin: "first record for barcode",
};

function flagLabel(code: string): string {
  return FLAG_LABELS[code] ?? code;
}

function FlagChip({ flag }: { flag: FoodFlag }) {
  return (
    <span className={`flag flag-${flag.severity}`} title={flag.detail ?? ""}>
      {flagLabel(flag.code)}
    </span>
  );
}

export function ReviewView() {
  const [status, setStatus] = useState<FoodReviewStatus>("pending");
  const [severity, setSeverity] = useState<string>("");
  const [rows, setRows] = useState<ReviewQueueRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.reviewQueue({
        status,
        severity: severity || undefined,
      });
      setRows(res.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load queue");
    } finally {
      setLoading(false);
    }
  }, [status, severity]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  return (
    <div className="review">
      <div className="row">
        <label>
          Status
          <select
            value={status}
            onChange={(e) => {
              setSelectedId(null);
              setStatus(e.target.value as FoodReviewStatus);
            }}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label>
          Severity
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
          >
            <option value="">any</option>
            <option value="high">high</option>
            <option value="medium">medium</option>
            <option value="low">low</option>
          </select>
        </label>
        <button className="tab" onClick={() => void loadQueue()}>
          Refresh
        </button>
        <span className="hint">
          {loading ? "loading…" : `${rows.length} row(s)`}
        </span>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <table className="queue">
        <thead>
          <tr>
            <th>Food</th>
            <th>Owner</th>
            <th className="num">Entered</th>
            <th className="num">Computed</th>
            <th>Flags</th>
            <th className="num">Reports</th>
            <th>Added</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className={row.id === selectedId ? "selected" : undefined}
              onClick={() => setSelectedId(row.id)}
            >
              <td>
                {/* A barcode is a global key — one bad record is served to
                    everyone who scans that product, which is why these sort
                    to the top of the queue. Mark them unmistakably. */}
                {row.barcode ? (
                  <span className="barcode-dot" title={`Barcode ${row.barcode}`}>
                    ▮
                  </span>
                ) : null}
                <strong>{row.name}</strong>
                {row.brand ? <span className="hint"> · {row.brand}</span> : null}
              </td>
              <td className="hint">{row.ownerEmail ?? "—"}</td>
              <td className="num">{row.energyKcal}</td>
              <td
                className={
                  Math.abs(row.kcalDelta) > 20 ? "num mismatch" : "num"
                }
              >
                {row.computedKcal}
              </td>
              <td>
                {row.reviewFlags.map((f) => (
                  <FlagChip key={f.code} flag={f} />
                ))}
              </td>
              <td className="num">{row.openReports || ""}</td>
              <td className="hint">{row.createdAt.slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {selectedId ? (
        <ReviewDetailPanel
          id={selectedId}
          onDone={() => {
            setSelectedId(null);
            void loadQueue();
          }}
        />
      ) : null}
    </div>
  );
}

function ReviewDetailPanel({
  id,
  onDone,
}: {
  id: string;
  onDone: () => void;
}) {
  const [detail, setDetail] = useState<ReviewDetail | null>(null);
  const [draft, setDraft] = useState<FoodDraft | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmReject, setConfirmReject] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.reviewFood(id);
      setDetail(res);
      setDraft(draftFromDto(res.food));
      setConfirmReject(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load food");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <p className="error">{error}</p>;
  if (!detail || !draft) return <p className="hint">Loading…</p>;

  const unitFlag = detail.food.reviewFlags.find(
    (f) => f.code === "energy_unit_confusion",
  );

  const run = async (fn: () => Promise<unknown>, close: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      if (close) onDone();
      else await load();
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Request failed — see server log",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="box editor">
      <h2>
        {detail.food.name}
        {detail.food.brand ? ` · ${detail.food.brand}` : ""}
      </h2>
      <p className="hint">
        {detail.ownerEmail ?? "unknown owner"} · v{detail.food.version} ·{" "}
        {detail.food.reviewStatus}
        {detail.food.barcode ? ` · barcode ${detail.food.barcode}` : ""}
      </p>

      {/* The comparison that resolves most of the queue at a glance. */}
      <div className="row kcal-compare">
        <div>
          <span className="hint">Entered</span>
          <strong>{detail.food.energyKcal} kcal</strong>
        </div>
        <div>
          <span className="hint">Computed from macros</span>
          <strong>{detail.computedKcal} kcal</strong>
        </div>
        {unitFlag?.value !== undefined ? (
          <button
            className="tab"
            disabled={busy}
            onClick={() =>
              void run(
                () =>
                  api.correctReviewFood(id, { energyKcal: unitFlag.value }),
                false,
              )
            }
          >
            Apply implied {unitFlag.value} kcal
          </button>
        ) : null}
      </div>

      <div className="row">
        {detail.food.reviewFlags.map((f) => (
          <FlagChip key={f.code} flag={f} />
        ))}
      </div>

      {detail.reports.length > 0 ? (
        <div className="box">
          <h3>Reports</h3>
          {detail.reports.map((r) => (
            <div key={r.id} className="row">
              <span>{r.reason}</span>
              <span className="hint">{r.reporterEmail ?? "—"}</span>
              {r.resolvedAt ? (
                <span className="hint">resolved</span>
              ) : (
                <button
                  className="tab"
                  disabled={busy}
                  onClick={() => void run(() => api.resolveReport(r.id), false)}
                >
                  Resolve
                </button>
              )}
            </div>
          ))}
        </div>
      ) : null}

      <h3>Correct</h3>
      <FoodForm draft={draft} onChange={setDraft} />
      <div className="actions">
        <button
          disabled={busy}
          onClick={() =>
            void run(
              () => api.correctReviewFood(id, toUpdatePayload(draft)),
              false,
            )
          }
        >
          Save correction
        </button>
        <span className="hint">
          Saving a correction never changes the status — correcting and
          deciding are separate acts.
        </span>
      </div>

      <h3>Decision</h3>
      <textarea
        placeholder="Note (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="actions">
        <button
          disabled={busy}
          onClick={() =>
            void run(
              () => api.reviewDecision(id, "approved", note || undefined),
              true,
            )
          }
        >
          Approve
        </button>
        <button
          disabled={busy}
          onClick={() =>
            void run(
              () => api.reviewDecision(id, "needs_edit", note || undefined),
              true,
            )
          }
        >
          Needs edit
        </button>
        {confirmReject ? (
          <button
            className="danger"
            disabled={busy}
            onClick={() =>
              void run(
                () => api.reviewDecision(id, "rejected", note || undefined),
                true,
              )
            }
          >
            Confirm reject — removes it from search
          </button>
        ) : (
          <button className="danger" onClick={() => setConfirmReject(true)}>
            Reject…
          </button>
        )}
        <button className="tab" onClick={onDone}>
          Close
        </button>
      </div>

      {detail.history.length > 0 ? (
        <div className="box">
          <h3>History</h3>
          {detail.history.map((h) => (
            <div key={h.id} className="row">
              <span>
                {h.fromStatus} → {h.toStatus}
              </span>
              <span className="hint">v{h.foodVersion}</span>
              <span className="hint">{h.reviewerEmail ?? "system"}</span>
              <span className="hint">{h.createdAt.slice(0, 16)}</span>
              {h.note ? <span>{h.note}</span> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
