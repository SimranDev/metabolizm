import { useEffect, useState } from "react";

import { ApiError, api, type FoodListRow } from "./api";
import { draftFromDto, toUpdatePayload, type FoodDraft } from "./draft";
import { FoodForm } from "./food-form";

export function BrowseView() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<FoodListRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<FoodDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = async (query: string) => {
    try {
      const res = await api.listFoods(query);
      setRows(res.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    const handle = setTimeout(() => void refresh(q), 300);
    return () => clearTimeout(handle);
  }, [q]);

  const open = async (id: string) => {
    setError(null);
    setNotice(null);
    try {
      const dto = await api.getFood(id);
      setSelectedId(id);
      setDraft(draftFromDto(dto));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const save = async () => {
    if (!selectedId || !draft) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await api.updateFood(selectedId, toUpdatePayload(draft));
      setDraft(draftFromDto(updated));
      setNotice(`Saved (version ${updated.version})`);
      await refresh(q);
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(0, String(e));
      setError(
        err.status === 409 ? `Barcode conflict: ${err.message}` : err.message,
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!selectedId) return;
    if (!window.confirm("Soft-delete this food?")) return;
    setBusy(true);
    setError(null);
    try {
      await api.deleteFood(selectedId);
      setSelectedId(null);
      setDraft(null);
      setNotice("Deleted (soft)");
      await refresh(q);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <input
        className="search"
        placeholder="Search system foods by name…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      {error && <div className="box error">{error}</div>}
      {notice && <div className="box ok">{notice}</div>}

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Brand</th>
            <th className="num">kcal</th>
            <th className="num">P</th>
            <th className="num">C</th>
            <th className="num">F</th>
            <th>Verified</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className={row.id === selectedId ? "selected" : ""}
              onClick={() => void open(row.id)}
            >
              <td>{row.name}</td>
              <td>{row.brand ?? "—"}</td>
              <td className="num">{row.energyKcal}</td>
              <td className="num">{row.proteinG}</td>
              <td className="num">{row.carbsG}</td>
              <td className="num">{row.fatG}</td>
              <td>{row.isVerified ? "✓" : ""}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="hint">
                No system foods match.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {draft && selectedId && (
        <div className="editor">
          <h2>
            Edit <code>{selectedId}</code>
          </h2>
          <FoodForm draft={draft} onChange={setDraft} />
          <div className="actions">
            <button onClick={() => void save()} disabled={busy}>
              {busy ? "…" : "Save"}
            </button>
            <button className="danger" onClick={() => void remove()} disabled={busy}>
              Delete
            </button>
            <button
              className="ghost"
              onClick={() => {
                setSelectedId(null);
                setDraft(null);
              }}
              disabled={busy}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
