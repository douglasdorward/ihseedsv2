import type { CatalogueCategory } from "./catalogue";

type Named = Pick<CatalogueCategory, "name">;
type SubCopy = Pick<CatalogueCategory, "name" | "pageHeading" | "seoTitle" | "seoDescription" | "lead">;

const DESCRIPTION_LIMIT = 300;

function clean(value: string | undefined | null) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

/**
 * Visible H1 for a sub-category page. Uses the admin-written heading when set,
 * otherwise "{sub} {root}" (or just the sub name when it already says the root).
 */
export function subcategoryHeading(root: Named, sub: Pick<SubCopy, "name" | "pageHeading">) {
  const custom = clean(sub.pageHeading);
  if (custom) return custom;
  const name = clean(sub.name);
  const rootName = clean(root.name);
  if (!rootName || name.toLowerCase().includes(rootName.toLowerCase())) return name;
  return `${name} ${rootName}`;
}

/** Search-result title: admin SEO title, else a generated one from the heading. */
export function subcategoryTitle(root: Named, sub: SubCopy) {
  return clean(sub.seoTitle) || `${subcategoryHeading(root, sub)} Seed | IH Seeds`;
}

function limit(text: string) {
  if (text.length <= DESCRIPTION_LIMIT) return text;
  const cut = text.slice(0, DESCRIPTION_LIMIT - 1);
  const sentenceEnd = cut.lastIndexOf(". ");
  return sentenceEnd > 120 ? cut.slice(0, sentenceEnd + 1) : `${cut.trimEnd()}…`;
}

/**
 * Intro copy shown under the H1. Prefers the admin lead; otherwise the
 * auto-generated range summary so a page never launches with an empty intro.
 */
export function subcategoryIntro(
  root: Named,
  sub: SubCopy,
  generated: { sentence: string; productCount: number },
) {
  const lead = clean(sub.lead);
  if (lead) return lead;
  const heading = subcategoryHeading(root, sub);
  const range = generated.productCount > 0
    ? `IH Seeds ${heading.toLowerCase()}: ${generated.productCount} ${generated.productCount === 1 ? "line" : "lines"} in our range.`
    : `IH Seeds ${heading.toLowerCase()}.`;
  return clean(`${range} ${generated.sentence}`);
}

/** Meta description: admin SEO description, else lead, else the generated intro. */
export function subcategoryDescription(
  root: Named,
  sub: SubCopy,
  generated: { sentence: string; productCount: number },
) {
  return limit(clean(sub.seoDescription) || subcategoryIntro(root, sub, generated));
}
