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

/** Commercial order for the Mixes group. Each line is a phrase that still
 *  appears in the title on https://irwinhunter.com.au/availability, after
 *  dropping case, spaces, ™ and "&". That covers "NITRO MIX" and "NITROMIX",
 *  and "Silahay Pasture Mix™". Unlisted mixes follow alphabetically. */
const MIX_LINEUP = [
  ["custom mix and match", "custom mix", "mix and match"],
  ["souwest"],
  ["silahay"],
  ["self regeneration"],
  ["maximix"],
  ["equi1st", "equi 1st"],
  ["western annual"],
  ["cover crop plus winter"],
  ["cover crop plus summer"],
  ["nitromix", "nitro mix"],
  ["interow"],
  ["dairy select"],
  ["irrigation"],
  ["green manure"],
  ["gentle graze"],
];

function compactName(name: string) {
  return name
    .toLowerCase()
    .replace(/[™®]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "")
    ;
}

function mixLineupRank(name: string) {
  const compact = compactName(name);
  const index = MIX_LINEUP.findIndex((aliases) =>
    aliases.some((alias) => compact.includes(compactName(alias))),
  );
  return index === -1 ? MIX_LINEUP.length : index;
}

function byMixLineup(a: CatalogueProduct, b: CatalogueProduct) {
  return mixLineupRank(a.name) - mixLineupRank(b.name) || byName(a, b);
}

function byAvailability(categoryName: string) {
  return categoryName.localeCompare("Mixes", "en-AU", { sensitivity: "base" }) === 0
    ? byMixLineup
    : byName;
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
  const matched = products.filter((product) => matchesQuery(product, query));
  if (view === "alpha") {
    const productsInNameOrder = [...matched].sort(byName);
    return productsInNameOrder.length === 0 ? [] : [{ key: "alpha", heading: null, products: productsInNameOrder }];
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
      products: [...grouped].sort(byAvailability(category.name)),
    }];
  });

  const rooted = new Set(roots.map((category) => category.name));
  const other = matched.filter((product) => !rooted.has(product.category));
  if (other.length > 0) {
    sections.push({ key: "other", heading: { name: "Other", href: null }, products: [...other].sort(byName) });
  }
  return sections;
}
