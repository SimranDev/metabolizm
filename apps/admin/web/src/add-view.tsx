import { useState } from "react";

import { ApiError, api } from "./api";
import { draftFromParsed, emptyDraft, toCreatePayload, type FoodDraft } from "./draft";
import { FoodForm } from "./food-form";

export function AddView() {
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<FoodDraft | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState<"parse" | "insert" | null>(null);
  const [error, setError] = useState<{ message: string } | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const parse = async () => {
    setBusy("parse");
    setError(null);
    setCreatedId(null);
    try {
      const res = await api.parse(text);
      setDraft(draftFromParsed(res.food));
      setWarnings(res.warnings);
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(0, String(e));
      setError({ message: err.message });
    } finally {
      setBusy(null);
    }
  };

  const insert = async () => {
    if (!draft) return;
    setBusy("insert");
    setError(null);
    try {
      const created = await api.createFood(toCreatePayload(draft));
      setCreatedId(created.id);
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(0, String(e));
      setError({ message: err.message });
    } finally {
      setBusy(null);
    }
  };

  const reset = () => {
    setText("");
    setDraft(null);
    setWarnings([]);
    setError(null);
    setCreatedId(null);
  };

  return (
    <div>
      <p className="hint">
        Paste a USDA food JSON — or skip and fill the form manually.
      </p>
      <textarea
        rows={8}
        placeholder="Paste one food object from a FoodData Central download or /food/{fdcId} API response"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="actions">
        <button onClick={() => void parse()} disabled={!text.trim() || busy !== null}>
          {busy === "parse" ? "Parsing…" : "Parse"}
        </button>
        <button
          onClick={() => {
            setDraft(emptyDraft());
            setWarnings([]);
            setCreatedId(null);
          }}
          disabled={busy !== null}
        >
          Start blank
        </button>
        {(draft || createdId) && (
          <button className="ghost" onClick={reset} disabled={busy !== null}>
            Start over
          </button>
        )}
      </div>

      {error && (
        <div className="box error">
          <strong>{error.message}</strong>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="box warn">
          {warnings.map((w, i) => (
            <div key={i}>⚠ {w}</div>
          ))}
        </div>
      )}
      {createdId && (
        <div className="box ok">
          Inserted — id <code>{createdId}</code>
        </div>
      )}

      {draft && (
        <>
          <FoodForm draft={draft} onChange={setDraft} />
          <div className="actions">
            <button
              onClick={() => void insert()}
              disabled={busy !== null || !draft.name.trim()}
            >
              {busy === "insert" ? "Inserting…" : "Insert into system catalog"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
