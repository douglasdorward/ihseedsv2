import type { Product } from "./hooks/useApi";

export type CatalogueCategorySlug =
  | "mixes"
  | "ryegrass"
  | "clovers"
  | "fescues-other-grasses"
  | "serradella"
  | "lucerne"
  | "herbs"
  | "sub-tropical-grasses"
  | "biologicals"
  | "forage-grain-crops"
  | "other";

export type CatalogueCategory = {
  slug: CatalogueCategorySlug;
  group: "Mixes" | "Grasses" | "Legumes" | "Other";
  name: string;
  light: string;
  bold: string;
  lead: string;
  rainfall: string;
  image: string;
  adminCategories: string[];
};

const images = [
  "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1530507629858-e4977d30e9e0?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1499529112087-3cb3b73cec95?auto=format&fit=crop&w=900&q=80",
];

export const CATALOGUE_CATEGORIES: CatalogueCategory[] = [
  {
    slug: "mixes",
    group: "Mixes",
    name: "Specialty Mixes",
    light: "Specialty",
    bold: "Mixes",
    lead: "Blended to order for the paddock they are going into. Designed for specific rainfall zones and grazing plans.",
    rainfall: "400–800+ mm",
    image: images[0],
    adminCategories: ["Mixes", "Specialty Mixes"],
  },
  {
    slug: "ryegrass",
    group: "Grasses",
    name: "Ryegrass",
    light: "Pasture",
    bold: "Ryegrass",
    lead: "Annual, Italian and perennial types for high rainfall and irrigated country.",
    rainfall: "500–900+ mm",
    image: images[1],
    adminCategories: ["Ryegrasses"],
  },
  {
    slug: "clovers",
    group: "Legumes",
    name: "Clovers",
    light: "Sub &",
    bold: "Clovers",
    lead: "Sub, balansa, arrowleaf and Persian clovers across the rainfall range.",
    rainfall: "300–700+ mm",
    image: images[2],
    adminCategories: ["Clovers"],
  },
  {
    slug: "fescues-other-grasses",
    group: "Grasses",
    name: "Fescues & Other Grasses",
    light: "Fescues &",
    bold: "Other Grasses",
    lead: "Temperate pasture grasses for grazing, hay, persistence and specialist uses.",
    rainfall: "Varies by product",
    image: images[1],
    adminCategories: ["Fescues & Other Grasses"],
  },
  {
    slug: "serradella",
    group: "Legumes",
    name: "Serradellas & Medics",
    light: "Serradellas &",
    bold: "Medics",
    lead: "Hard-seeded regenerating legumes for lighter soils and the wheatbelt.",
    rainfall: "300–500+ mm",
    image: images[0],
    adminCategories: ["Serradellas & Medics"],
  },
  {
    slug: "lucerne",
    group: "Legumes",
    name: "Lucerne",
    light: "Winter-active",
    bold: "Lucerne",
    lead: "Persistent hay and grazing stands selected across winter-activity classes.",
    rainfall: "350–650+ mm",
    image: images[3],
    adminCategories: ["Lucerne"],
  },
  {
    slug: "herbs",
    group: "Other",
    name: "Pasture Herbs",
    light: "Pasture",
    bold: "Herbs",
    lead: "Forage herbs selected for productive and diverse pasture systems.",
    rainfall: "Varies by product",
    image: images[2],
    adminCategories: ["Herbs"],
  },
  {
    slug: "sub-tropical-grasses",
    group: "Grasses",
    name: "Sub-Tropical Grasses",
    light: "Sub-tropical",
    bold: "Grasses",
    lead: "Warm-season grasses for resilient grazing systems in suitable regions.",
    rainfall: "Varies by product",
    image: images[1],
    adminCategories: ["Sub-Tropical Grasses"],
  },
  {
    slug: "biologicals",
    group: "Other",
    name: "Biologicals",
    light: "Seed",
    bold: "Biologicals",
    lead: "Seed-applied and pasture biological products supporting establishment and performance.",
    rainfall: "See product details",
    image: images[3],
    adminCategories: ["Biologicals"],
  },
  {
    slug: "forage-grain-crops",
    group: "Other",
    name: "Forage & Grain Crops",
    light: "Forage &",
    bold: "Grain Crops",
    lead: "Seasonal forage and grain options for grazing, conserved feed and rotations.",
    rainfall: "Varies by product",
    image: images[0],
    adminCategories: ["Forage & Grain Crops"],
  },
  {
    slug: "other",
    group: "Other",
    name: "Other Products",
    light: "Other",
    bold: "Products",
    lead: "Additional pasture and seed products available from the current IH Seeds range.",
    rainfall: "See product details",
    image: images[2],
    adminCategories: ["Other"],
  },
];

const normalizeCategory = (value: string) => value.trim().toLocaleLowerCase();

export function getCatalogueCategory(slug: string | undefined) {
  return CATALOGUE_CATEGORIES.find((category) => category.slug === slug);
}

export function getProductCategorySlug(product: Pick<Product, "category">): CatalogueCategorySlug {
  const categoryName = normalizeCategory(product.category);
  return CATALOGUE_CATEGORIES.find((category) =>
    category.adminCategories.some((name) => normalizeCategory(name) === categoryName),
  )?.slug ?? "other";
}

export function countProductsByCategory(products: Product[]) {
  return products.reduce<Record<CatalogueCategorySlug, number>>((counts, product) => {
    const slug = getProductCategorySlug(product);
    counts[slug] += 1;
    return counts;
  }, {
    mixes: 0,
    ryegrass: 0,
    clovers: 0,
    "fescues-other-grasses": 0,
    serradella: 0,
    lucerne: 0,
    herbs: 0,
    "sub-tropical-grasses": 0,
    biologicals: 0,
    "forage-grain-crops": 0,
    other: 0,
  });
}