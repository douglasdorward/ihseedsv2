import { useState } from "react";

export const SEED_FORM_PRESETS = [
  "",
  "Bare / de-hulled",
  "Podded",
  "Coated",
  "Coated + Gaucho",
  "BioNPK-S coated",
  "Goldstrike coated",
  "Scarified",
  "Lime coated",
  "Inoculated",
  "Inoculated & treated with BioNPK Powder S",
] as const;

const CUSTOM_SEED_FORM = "__custom__";

export function SeedFormField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const known = (SEED_FORM_PRESETS as readonly string[]).includes(value);
  const [creating, setCreating] = useState(false);
  const custom = creating || !known;
  return (
    <label>
      Seed form
      <select
        value={custom ? CUSTOM_SEED_FORM : value}
        onChange={(event) => {
          const next = event.target.value;
          if (next === CUSTOM_SEED_FORM) {
            setCreating(true);
            if (known) onChange("");
            return;
          }
          setCreating(false);
          onChange(next);
        }}
      >
        {SEED_FORM_PRESETS.map((option) => (
          <option key={option || "unset"} value={option}>{option || "Not set"}</option>
        ))}
        <option value={CUSTOM_SEED_FORM}>Create a form…</option>
      </select>
      {custom && (
        <input
          value={known ? "" : value}
          maxLength={80}
          placeholder="Type a seed form"
          aria-label="Custom seed form"
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      <span className="admin-field-hint">Another form is another sale line.</span>
    </label>
  );
}
