import type { CatalogueCategory, CatalogueProduct } from "./catalogue";
import { categoryPublicPath } from "./catalogue-paths";

export type AvailabilityView = "category" | "alpha";

export type AvailabilitySection = {
  key: string;
  heading: { name: string; href: string | null } | null;
  products: CatalogueProduct[];
};

function byName(a: CatalogueProduct, b: CatalogueProduct) {
  return a.name.localeCompare(b.name, "en-AU", { sensitivity: "base" }) || a.id - b.id;
}

function matchesQuery(product: CatalogueProduct, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const haystack = `${product.name} ${product.details.tagline ?? ""}`.toLowerCase();
  return haystack.includes(needle);
}

export function listAvailability({
  products,
  categories,
  view,
  query,
}: {
  products: CatalogueProduct[];
  categories: CatalogueCategory[];
  view: AvailabilityView;
  query: string;
}): AvailabilitySection[] {
  const matched = products.filter((product) => matchesQuery(product, query)).sort(byName);
  if (view === "alpha") {
    return matched.length === 0 ? [] : [{ key: "alpha", heading: null, products: matched }];
  }

  const roots = categories
    .filter((category) => category.parentId === null && category.active)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "en-AU", { sensitivity: "base" }));

  const sections: AvailabilitySection[] = roots.flatMap((category) => {
    const grouped = matched.filter((product) => product.category === category.name);
    if (grouped.length === 0) return [];
    return [{
      key: `category-${category.id}`,
      heading: { name: category.name, href: categoryPublicPath(category) },
      products: grouped,
    }];
  });

  const rooted = new Set(roots.map((category) => category.name));
  const other = matched.filter((product) => !rooted.has(product.category));
  if (other.length > 0) {
    sections.push({ key: "other", heading: { name: "Other", href: null }, products: other });
  }
  return sections;
}
