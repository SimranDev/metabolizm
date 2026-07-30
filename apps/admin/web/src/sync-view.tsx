/**
 * Sync tab — pull test accounts from the live database into this local one.
 *
 * Two steps, always: Preview reads both databases and writes nothing, Apply
 * runs the identical collection again inside one local transaction. Apply is
 * never the first thing you can press — the plan has to be on screen first,
 * because "22 inserts, 3 updates, 1 local-only row deleted" is the only part of
 * this that tells you whether the selection was right.
 *
 * The report leads with what CHANGES, not with what exists: a row that is
 * already identical locally is counted and then left alone.
 */
import { useCallback, useEffect, useState } from "react";

import {
  api,
  ApiError,
  type DbIdentity,
  type SyncPlan,
  type SyncStatus,
  type SyncUserRow,
  type TablePlan,
} from "./api";

function describe(db: DbIdentity): string {
  return `${db.user}@${db.host}:${db.port}/${db.database}`;
}

export function SyncView() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<SyncUserRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [includeGroups, setIncludeGroups] = useState(true);
  const [prune, setPrune] = useState(false);
  const [plan, setPlan] = useState<SyncPlan | null>(null);
  const [confirmApply, setConfirmApply] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        setStatus(await api.syncStatus());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to read sync status");
      }
    })();
  }, []);

  const ready = status?.ready ?? false;

  const loadUsers = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.syncUsers(q);
      setRows(res.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to list live users");
    } finally {
      setLoading(false);
    }
  }, [q, ready]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  // Any change to the selection or the options invalidates the plan on screen —
  // applying a stale preview is the one way this tool could surprise someone.
  const invalidate = () => {
    setPlan(null);
    setConfirmApply(false);
  };

  const toggle = (id: string) => {
    invalidate();
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  };

  const run = async (apply: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const body = { userIds: selected, includeGroups, prune };
      const result = apply ? await api.syncApply(body) : await api.syncPlan(body);
      setPlan(result);
      setConfirmApply(false);
      if (apply) await loadUsers();
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Request failed — see server log",
      );
      setConfirmApply(false);
    } finally {
      setBusy(false);
    }
  };

  if (!status) return <p className="hint">Loading…</p>;

  return (
    <div className="sync">
      <div className={ready ? "box ok" : "box warn"}>
        <div className="row">
          <span className="hint">read from</span>
          <code>{status.source ? describe(status.source) : "not configured"}</code>
          <span className="hint">→ write to</span>
          <code>{describe(status.target)}</code>
        </div>
        {status.reason ? <p className="hint">{status.reason}</p> : null}
        {ready ? (
          <p className="hint">
            The live database is opened read-only. Only{" "}
            <code>{status.target.database}</code> is written, and sync refuses to
            run unless that is a local host.
          </p>
        ) : null}
      </div>

      {error ? <p className="error">{error}</p> : null}

      {ready ? (
        <>
          <div className="row search">
            <input
              placeholder="Search live users by email or name…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button className="tab" onClick={() => void loadUsers()}>
              Refresh
            </button>
            <span className="hint">
              {loading ? "loading…" : `${rows.length} account(s)`}
            </span>
          </div>

          <table className="queue">
            <thead>
              <tr>
                <th />
                <th>Account</th>
                <th className="num">Diary</th>
                <th className="num">Weigh-ins</th>
                <th className="num">Groups</th>
                <th className="num">Foods</th>
                <th>Local</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className={selected.includes(row.id) ? "selected" : undefined}
                  onClick={() => toggle(row.id)}
                >
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.includes(row.id)}
                      onChange={() => toggle(row.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td>
                    <strong>{row.email}</strong>
                    <span className="hint">
                      {" "}
                      · {row.name} · {row.region} · {row.timezone}
                    </span>
                  </td>
                  <td className="num">{row.live.diaryEntries || ""}</td>
                  <td className="num">{row.live.weightEntries || ""}</td>
                  <td className="num">{row.live.groups || ""}</td>
                  <td className="num">{row.live.foods || ""}</td>
                  <td className="hint">
                    {/* Absent locally is the case this tab exists for, so say
                        it in words rather than leaving the cell blank. */}
                    {row.local === null
                      ? "not local"
                      : `${row.local.diaryEntries} diary · ${row.local.weightEntries} weigh-ins`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="row">
            <label className="inline">
              <input
                type="checkbox"
                checked={includeGroups}
                onChange={(e) => {
                  invalidate();
                  setIncludeGroups(e.target.checked);
                }}
              />
              Include groups
            </label>
            <span className="hint">
              pulls each group whole — every membership, invitation and join
              request — with co-members arriving as an identity only
            </span>
          </div>
          <div className="row">
            <label className="inline">
              <input
                type="checkbox"
                checked={prune}
                onChange={(e) => {
                  invalidate();
                  setPrune(e.target.checked);
                }}
              />
              Prune local-only rows
            </label>
            <span className="hint">
              deletes rows these accounts have locally but not on live. Never
              touches other people&apos;s rows, group records themselves, or the
              system catalog.
            </span>
          </div>

          <div className="actions">
            <button
              className="ghost"
              disabled={busy || selected.length === 0}
              onClick={() => void run(false)}
            >
              Preview {selected.length ? `${selected.length} account(s)` : ""}
            </button>
            {plan && !plan.applied && plan.blockers.length === 0 ? (
              confirmApply ? (
                <button disabled={busy} onClick={() => void run(true)}>
                  Confirm — write {plan.totals.insert + plan.totals.update} row(s)
                  {prune && plan.totals.localOnly > 0
                    ? `, delete ${plan.totals.localOnly}`
                    : ""}
                </button>
              ) : (
                <button disabled={busy} onClick={() => setConfirmApply(true)}>
                  Apply…
                </button>
              )
            ) : null}
            {busy ? <span className="hint">working…</span> : null}
          </div>

          {plan ? <PlanReport plan={plan} /> : null}
        </>
      ) : null}
    </div>
  );
}

function PlanReport({ plan }: { plan: SyncPlan }) {
  const [open, setOpen] = useState<string | null>(null);
  const nothing =
    plan.totals.insert === 0 &&
    plan.totals.update === 0 &&
    plan.totals.localOnly === 0;

  return (
    <div className="box editor">
      <h2>
        {plan.applied ? "Applied" : "Preview"} ·{" "}
        {plan.totals.insert} new · {plan.totals.update} changed ·{" "}
        {plan.totals.unchanged} identical
        {plan.totals.localOnly > 0
          ? ` · ${plan.totals.localOnly} local-only`
          : ""}
        {plan.totals.pruned > 0 ? ` · ${plan.totals.pruned} deleted` : ""}
      </h2>
      {nothing ? (
        <p className="hint">
          Local already matches live for these accounts — nothing to write.
        </p>
      ) : null}

      {plan.blockers.length > 0 ? (
        <div className="box error">
          <h3>Blocked</h3>
          {plan.blockers.map((b) => (
            <p key={b.message}>
              <code>{b.table}</code> {b.message}
            </p>
          ))}
        </div>
      ) : null}

      {plan.warnings.length > 0 ? (
        <div className="box warn">
          <h3>Notes</h3>
          {plan.warnings.map((w) => (
            <p key={w} className="hint">
              {w}
            </p>
          ))}
        </div>
      ) : null}

      <h3>Accounts</h3>
      <div className="row wrap">
        {plan.users.map((user) => (
          <span
            key={user.id}
            className={user.role === "selected" ? "flag" : "flag flag-low"}
            title={
              user.role === "selected"
                ? "Selected — full data graph"
                : "Referenced by a selected account (group co-member, coach, reviewer). Identity row only: no diary, weight or targets."
            }
          >
            {user.email}
            {user.role === "dependency" ? " · identity only" : ""}
          </span>
        ))}
      </div>

      <h3>Tables</h3>
      <table className="queue">
        <thead>
          <tr>
            <th>Table</th>
            <th className="num">New</th>
            <th className="num">Changed</th>
            <th className="num">Identical</th>
            <th className="num">Kept</th>
            <th className="num">Local-only</th>
            <th className="num">Deleted</th>
          </tr>
        </thead>
        <tbody>
          {plan.tables.map((table) => (
            <tr
              key={table.table}
              className={table.table === open ? "selected" : undefined}
              onClick={() => setOpen(table.table === open ? null : table.table)}
            >
              <td>
                <code>{table.table}</code>
              </td>
              <td className="num">{table.insert || ""}</td>
              <td className="num">{table.update || ""}</td>
              <td className="num hint">{table.unchanged || ""}</td>
              <td className="num hint" title="Insert-only: a local copy already exists">
                {table.skipped || ""}
              </td>
              <td className={table.localOnly ? "num mismatch" : "num"}>
                {table.localOnly || ""}
              </td>
              <td className="num">{table.pruned || ""}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {open ? (
        <TableDetail
          table={plan.tables.find((t) => t.table === open)!}
          applied={plan.applied}
        />
      ) : (
        <p className="hint">Select a table for the columns and rows involved.</p>
      )}
    </div>
  );
}

function TableDetail({
  table,
  applied,
}: {
  table: TablePlan;
  applied: boolean;
}) {
  const columns = Object.entries(table.changedColumns).sort(
    (a, b) => b[1] - a[1],
  );

  return (
    <div className="box">
      <h3>{table.table}</h3>

      {columns.length > 0 ? (
        <div className="row wrap">
          {columns.map(([column, count]) => (
            <span key={column} className="flag flag-medium">
              {column} × {count}
            </span>
          ))}
        </div>
      ) : null}

      {table.samples.updates.length > 0 ? (
        <>
          <h3>Changed</h3>
          {table.samples.updates.map((row) => (
            <div key={row.label} className="change">
              <div>{row.label}</div>
              {row.changes.map((change) => (
                <div key={change.column} className="hint">
                  <code>{change.column}</code> {change.from} → {change.to}
                </div>
              ))}
            </div>
          ))}
        </>
      ) : null}

      {table.samples.inserts.length > 0 ? (
        <>
          <h3>New</h3>
          {table.samples.inserts.map((label) => (
            <div key={label} className="hint">
              {label}
            </div>
          ))}
        </>
      ) : null}

      {table.samples.localOnly.length > 0 ? (
        <>
          <h3>Local-only</h3>
          <p className="hint">
            {table.prunable
              ? applied
                ? "These existed locally and not on live."
                : "Tick “Prune local-only rows” to delete these."
              : "Not prunable — deleting one would reach rows outside this sync."}
          </p>
          {table.samples.localOnly.map((label) => (
            <div key={label} className="hint">
              {label}
            </div>
          ))}
        </>
      ) : null}
    </div>
  );
}
