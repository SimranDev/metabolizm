/**
 * Shared editable food form: all food fields, nutrient rows constrained to
 * the NUTRIENTS registry, and a portions editor. Controlled by the parent.
 */
import {
  NUTRIENTS,
  type NutrientGroup,
  type NutrientKey,
} from "@metabolizm/shared";

import type { FoodDraft, Num } from "./draft";

const GROUP_LABELS: Record<NutrientGroup, string> = {
  carb: "Carbohydrates",
  fat: "Fats",
  mineral: "Minerals",
  vitamin: "Vitamins",
  other: "Other",
};

const NUTRIENT_KEYS = (Object.keys(NUTRIENTS) as NutrientKey[]).sort(
  (a, b) => NUTRIENTS[a].sortOrder - NUTRIENTS[b].sortOrder,
);

function parseNum(raw: string): Num {
  return raw === "" ? "" : Number(raw);
}

type Props = {
  draft: FoodDraft;
  onChange: (draft: FoodDraft) => void;
};

export function FoodForm({ draft, onChange }: Props) {
  const set = (patch: Partial<FoodDraft>) => onChange({ ...draft, ...patch });

  const usedKeys = new Set(draft.nutrients.map((n) => n.key));
  const availableKeys = NUTRIENT_KEYS.filter((k) => !usedKeys.has(k));

  return (
    <div className="food-form">
      <div className="grid">
        <label className="span2">
          Name
          <input
            value={draft.name}
            onChange={(e) => set({ name: e.target.value })}
          />
        </label>
        <label>
          Brand
          <input
            value={draft.brand}
            onChange={(e) => set({ brand: e.target.value })}
          />
        </label>
        <label>
          Barcode
          <input
            value={draft.barcode}
            onChange={(e) => set({ barcode: e.target.value })}
          />
        </label>
        <label className="span4">
          Description
          <input
            value={draft.description}
            onChange={(e) => set({ description: e.target.value })}
          />
        </label>
        <label>
          Base unit
          <select
            value={draft.baseUnit}
            onChange={(e) => set({ baseUnit: e.target.value as "g" | "ml" })}
          >
            <option value="g">g (solid)</option>
            <option value="ml">ml (liquid)</option>
          </select>
        </label>
        <label>
          Serving size ({draft.baseUnit})
          <input
            type="number"
            min={0}
            value={draft.servingSize}
            onChange={(e) => set({ servingSize: parseNum(e.target.value) })}
          />
        </label>
        <label className="span2">
          Serving label
          <input
            placeholder="e.g. 1 glass"
            value={draft.servingLabel}
            onChange={(e) => set({ servingLabel: e.target.value })}
          />
        </label>
      </div>

      <h3>Per 100 {draft.baseUnit}</h3>
      <div className="grid">
        <label>
          Energy (kcal)
          <input
            type="number"
            min={0}
            value={draft.energyKcal}
            onChange={(e) => set({ energyKcal: parseNum(e.target.value) })}
          />
        </label>
        <label>
          Protein (g)
          <input
            type="number"
            min={0}
            value={draft.proteinG}
            onChange={(e) => set({ proteinG: parseNum(e.target.value) })}
          />
        </label>
        <label>
          Carbs (g)
          <input
            type="number"
            min={0}
            value={draft.carbsG}
            onChange={(e) => set({ carbsG: parseNum(e.target.value) })}
          />
        </label>
        <label>
          Fat (g)
          <input
            type="number"
            min={0}
            value={draft.fatG}
            onChange={(e) => set({ fatG: parseNum(e.target.value) })}
          />
        </label>
      </div>

      <h3>
        Nutrients <span className="hint">per 100 {draft.baseUnit}, canonical units</span>
      </h3>
      {draft.nutrients.map((row, i) => (
        <div className="row" key={row.key}>
          <select
            value={row.key}
            onChange={(e) => {
              const nutrients = [...draft.nutrients];
              nutrients[i] = { ...row, key: e.target.value as NutrientKey };
              set({ nutrients });
            }}
          >
            {[row.key, ...availableKeys].map((k) => (
              <option key={k} value={k}>
                {NUTRIENTS[k].displayName} ({k})
              </option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            value={row.value}
            onChange={(e) => {
              const nutrients = [...draft.nutrients];
              nutrients[i] = { ...row, value: parseNum(e.target.value) };
              set({ nutrients });
            }}
          />
          <span className="unit">{NUTRIENTS[row.key].unit}</span>
          <button
            type="button"
            className="ghost"
            onClick={() =>
              set({ nutrients: draft.nutrients.filter((_, j) => j !== i) })
            }
          >
            ✕
          </button>
        </div>
      ))}
      {availableKeys.length > 0 && (
        <select
          className="add-nutrient"
          value=""
          onChange={(e) => {
            if (!e.target.value) return;
            set({
              nutrients: [
                ...draft.nutrients,
                { key: e.target.value as NutrientKey, value: "" },
              ],
            });
          }}
        >
          <option value="">+ add nutrient…</option>
          {(Object.keys(GROUP_LABELS) as NutrientGroup[]).map((group) => (
            <optgroup key={group} label={GROUP_LABELS[group]}>
              {availableKeys
                .filter((k) => NUTRIENTS[k].group === group)
                .map((k) => (
                  <option key={k} value={k}>
                    {NUTRIENTS[k].displayName} ({NUTRIENTS[k].unit})
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      )}

      <h3>Portions</h3>
      {draft.portions.map((portion, i) => (
        <div className="row" key={portion.id ?? i}>
          <input
            placeholder="label, e.g. 1 glass"
            value={portion.label}
            onChange={(e) => {
              const portions = [...draft.portions];
              portions[i] = { ...portion, label: e.target.value };
              set({ portions });
            }}
          />
          <input
            type="number"
            min={0}
            title="quantity"
            value={portion.quantity}
            onChange={(e) => {
              const portions = [...draft.portions];
              portions[i] = { ...portion, quantity: parseNum(e.target.value) };
              set({ portions });
            }}
          />
          <span className="unit">×</span>
          <input
            type="number"
            min={0}
            title={`amount in ${draft.baseUnit}`}
            value={portion.amountInBase}
            onChange={(e) => {
              const portions = [...draft.portions];
              portions[i] = {
                ...portion,
                amountInBase: parseNum(e.target.value),
              };
              set({ portions });
            }}
          />
          <span className="unit">{draft.baseUnit}</span>
          <label className="inline">
            <input
              type="radio"
              name="default-portion"
              checked={portion.isDefault}
              onChange={() =>
                set({
                  portions: draft.portions.map((p, j) => ({
                    ...p,
                    isDefault: j === i,
                  })),
                })
              }
            />
            default
          </label>
          <button
            type="button"
            className="ghost"
            onClick={() =>
              set({ portions: draft.portions.filter((_, j) => j !== i) })
            }
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        className="ghost add"
        onClick={() =>
          set({
            portions: [
              ...draft.portions,
              {
                label: "",
                quantity: 1,
                amountInBase: "",
                isDefault: draft.portions.length === 0,
              },
            ],
          })
        }
      >
        + add portion
      </button>
    </div>
  );
}
