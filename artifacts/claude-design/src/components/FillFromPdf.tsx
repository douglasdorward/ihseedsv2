import { useEffect, useMemo, useRef, useState } from "react";
import {
  applyAcceptedSuggestions,
  extractProductFromPdf,
  formatSuggestionValue,
  type AiSuggestion,
} from "../ai-fill";

type ReviewSuggestion = AiSuggestion & { accepted: boolean };

const TAB_LABELS: Record<number, string> = {
  1: "Basics",
  2: "Agronomy & fit",
  3: "Category-specific",
  4: "Selling",
  5: "Content & publishing",
  6: "SEO",
};

export function FillFromPdf(props: {
  form: any;
  productId?: number;
  readOnly?: boolean;
  seed?: { suggestions: AiSuggestion[]; warnings: string[] } | null;
  onSeedConsumed?: () => void;
  onApply: (nextForm: any, highlightedPaths: string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<ReviewSuggestion[] | null>(null);
  const category = typeof props.form?.category === "string" ? props.form.category.trim() : "";

  const loadSuggestions = (rows: AiSuggestion[], nextWarnings: string[]) => {
    setError("");
    setWarnings(nextWarnings);
    setSuggestions(rows.map((suggestion) => ({
      ...suggestion,
      accepted: suggestion.current == null || suggestion.current === "" || (Array.isArray(suggestion.current) && !suggestion.current.length),
    })));
    if (!rows.length && !nextWarnings.length) setError("No fields could be filled from that PDF.");
  };

  useEffect(() => {
    if (!props.seed) return;
    loadSuggestions(props.seed.suggestions ?? [], props.seed.warnings ?? []);
  }, [props.seed]);

  const grouped = useMemo(() => {
    if (!suggestions?.length) return [];
    const tabs = new Map<number, ReviewSuggestion[]>();
    for (const suggestion of suggestions) {
      const tab = Number.isFinite(suggestion.tab) ? suggestion.tab : 0;
      const list = tabs.get(tab) ?? [];
      list.push(suggestion);
      tabs.set(tab, list);
    }
    return [...tabs.entries()].sort((first, second) => first[0] - second[0]);
  }, [suggestions]);

  const runExtract = async (file: File) => {
    setBusy(true);
    setError("");
    setWarnings([]);
    try {
      const result = await extractProductFromPdf(file, props.productId, category);
      loadSuggestions(result.suggestions ?? [], result.warnings ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Extraction failed.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="admin-fill-from-pdf wide">
      <div className="admin-section-heading">
        <div>
          <h3>Fill from PDF</h3>
          <p className="admin-field-hint">Upload a tech sheet. Suggested values can fill every tab the PDF supports (Basics, Agronomy, Category-specific, Content, SEO). Sale lines, slugs, and photos are never filled. Nothing is written to the live catalogue until you Save draft or Publish.</p>
        </div>
        <button
          type="button"
          className="admin-button outline small"
          disabled={props.readOnly || busy || !category}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? "Reading PDF…" : "Upload PDF"}
        </button>
      </div>
      {!category && <p className="admin-field-hint">Select a category first so category-specific and agronomy fields can be filled.</p>}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        data-testid="fill-from-pdf"
        disabled={props.readOnly || busy || !category}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void runExtract(file);
        }}
      />
      {error && <p className="admin-inline-field-error">{error}</p>}
      {warnings.map((warning) => <p key={warning} className="admin-field-hint">{warning}</p>)}
      {suggestions && (
        <div className="admin-ai-review" role="region" aria-label="Suggested fields from PDF">
          <div className="admin-ai-review-actions">
            <button type="button" className="admin-button ghost small" onClick={() => setSuggestions(suggestions.map((row) => ({ ...row, accepted: true })))}>Accept all</button>
            <button type="button" className="admin-button ghost small" onClick={() => setSuggestions(suggestions.map((row) => ({ ...row, accepted: false })))}>Reject all</button>
          </div>
          {suggestions.length === 0 && <p className="admin-empty-inline">No field suggestions. Check the warnings above.</p>}
          {grouped.map(([tab, rows]) => (
            <div className="admin-ai-review-tab" key={tab}>
              <h4>{TAB_LABELS[tab] ?? `Tab ${tab}`}</h4>
              {rows.map((suggestion) => (
                <label key={suggestion.path} className="admin-ai-review-row">
                  <input
                    type="checkbox"
                    checked={suggestion.accepted}
                    onChange={() => setSuggestions(suggestions.map((row) => row.path === suggestion.path ? { ...row, accepted: !row.accepted } : row))}
                  />
                  <span>
                    <strong>{suggestion.label}</strong>
                    <small>{suggestion.path}</small>
                    <span className="admin-ai-review-values">
                      <em>Now</em> {formatSuggestionValue(suggestion.current)}
                      <em>Suggested</em> {formatSuggestionValue(suggestion.proposed)}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          ))}
          <div className="admin-ai-review-actions">
            <button type="button" className="admin-button ghost small" onClick={() => { setSuggestions(null); props.onSeedConsumed?.(); }}>Dismiss</button>
            <button
              type="button"
              className="admin-button primary small"
              disabled={!suggestions.some((row) => row.accepted)}
              onClick={() => {
                const accepted = suggestions.filter((row) => row.accepted).map((row) => row.path);
                props.onApply(applyAcceptedSuggestions(props.form, suggestions), accepted);
                setSuggestions(null);
                props.onSeedConsumed?.();
              }}
            >
              Apply to form
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
