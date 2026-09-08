export type CatalogueProduct = {
  id: number;
  name: string;
  slug: string;
  price: string;
  packSize: string;
  status: string;
  note: string;
  category: string;
  details: {
    tagline: string;
  };
};

export type CatalogueCategory = {
  id: number;
  parentId: number | null;
  slug: string;
  name: string;
  groupLabel: string;
  lead: string;
  image: string;
  sortOrder: number;
  active: boolean;
};

function apiUrl(path: string) {
  const base = process.env.API_BASE?.replace(/\/+$/, "");
  if (!base) throw new Error("API_BASE environment variable is required.");
  return `${base}${path}`;
}

async function catalogueFetch<T>(path: string): Promise<T> {
  const response = await fetch(apiUrl(path), { next: { revalidate: 300 } });
  if (!response.ok) {
    throw new Error(`Catalogue request failed (${response.status}) for ${path}`);
  }
  return response.json() as Promise<T>;
}

export function getProducts() {
  return catalogueFetch<CatalogueProduct[]>("/api/products");
}

export function getCategories() {
  return catalogueFetch<CatalogueCategory[]>("/api/categories");
}