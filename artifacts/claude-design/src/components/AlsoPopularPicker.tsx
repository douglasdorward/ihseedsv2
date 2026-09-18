import { ALSO_POPULAR_LIMIT } from "../also-popular";

export type AlsoPopularOption = {
  id: number;
  name: string;
  slug: string;
  category: string;
};

function groupedOptions(options: AlsoPopularOption[]) {
  const groups = new Map<string, AlsoPopularOption[]>();
  for (const option of options) {
    const key = option.category || "Other";
    const list = groups.get(key) ?? [];
    list.push(option);
    groups.set(key, list);
  }
  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right));
}

export function AlsoPopularPicker({
  selectedSlugs,
  options,
  productsBySlug,
  readOnly,
  onChange,
  compact = false,
  heading = "Also popular",
  hint = "Choose up to three Active or New published products by name. Leave empty to show three other products from this category automatically. If a chosen product later becomes Legacy, that slot shows another current product from this category.",
  emptyLabel = "None chosen. The website will show three other products from this category.",
  addLabel = "Add Also popular product",
}: {
  selectedSlugs: string[];
  options: AlsoPopularOption[];
  productsBySlug: { get(slug: string): { id: number; name: string; slug: string } | undefined };
  readOnly: boolean;
  onChange: (slugs: string[]) => void;
  compact?: boolean;
  heading?: string;
  hint?: string;
  emptyLabel?: string;
  addLabel?: string;
}) {
  const chosen = selectedSlugs.map((slug) => slug.trim()).filter(Boolean).slice(0, ALSO_POPULAR_LIMIT);
  const available = options.filter((option) => !chosen.includes(option.slug));
  const canAdd = !readOnly && chosen.length < ALSO_POPULAR_LIMIT && available.length > 0;

  return (
    <div className={compact ? "ppe-also-popular-controls" : "admin-repeat-group wide"}>
      {!compact && (
        <div className="admin-section-heading">
          <div>
            <h3>{heading}</h3>
            <p className="admin-field-hint">{hint}</p>
          </div>
        </div>
      )}
      {canAdd && (
        <div className={compact ? "ppe-also-popular-add" : "admin-product-selector"}>
          <select
            className={compact ? "ppe-ghost" : undefined}
            value=""
            aria-label={addLabel}
            onChange={(event) => {
              const slug = event.target.value;
              if (!slug || chosen.includes(slug) || chosen.length >= ALSO_POPULAR_LIMIT) return;
              onChange([...chosen, slug]);
            }}
          >
            <option value="">Add a product</option>
            {groupedOptions(available).map(([category, items]) => (
              <optgroup key={category} label={category}>
                {items.map((option) => <option key={option.id} value={option.slug}>{option.name}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
      )}
      <div className={compact ? "ppe-also-popular-picks" : "admin-product-selections"}>
        {chosen.map((slug, index) => {
          const selectedProduct = productsBySlug.get(slug);
          const invalid = !options.some((option) => option.slug === slug);
          return compact ? (
            <span className={`ppe-also-popular-chip ${invalid ? "is-invalid" : ""}`} key={`${slug}-${index}`} title={invalid ? "Not a current published product. The website will show another product in this slot." : undefined}>
              <strong>{selectedProduct?.name ?? `Unknown product (${slug})`}</strong>
              {!readOnly && <button type="button" onClick={() => onChange(chosen.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${selectedProduct?.name ?? slug}`}>×</button>}
            </span>
          ) : (
            <div className={`admin-product-selection ${invalid ? "invalid" : ""}`} key={`${slug}-${index}`}>
              <span>
                <strong>{selectedProduct?.name ?? "Invalid Also popular reference"}</strong>
                <small>{invalid ? "Not a current published product. The website will show another product in this slot." : (selectedProduct?.slug ?? slug)}</small>
              </span>
              {!readOnly && <button type="button" onClick={() => onChange(chosen.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${selectedProduct?.name ?? slug}`}>Remove</button>}
            </div>
          );
        })}
        {chosen.length === 0 && (
          <p className={compact ? "ppe-also-popular-empty" : "admin-empty-inline"}>
            {emptyLabel}
          </p>
        )}
      </div>
    </div>
  );
}
