export const ALSO_POPULAR_LIMIT = 3;

export type AlsoPopularCandidate = {
  id?: number;
  name: string;
  slug: string;
  category: string;
  listingState?: unknown;
  listingOverride?: unknown;
  lifecycleStatus?: unknown;
  publishStatus?: unknown;
};

function fnv1a(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededShuffle<T>(items: T[], seed: string): T[] {
  const next = [...items];
  let state = fnv1a(seed) || 1;
  for (let i = next.length - 1; i > 0; i -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = state % (i + 1);
    const current = next[i]!;
    next[i] = next[j]!;
    next[j] = current;
  }
  return next;
}

function isSameProduct(candidate: AlsoPopularCandidate, product: { id?: number; slug: string }) {
  if (candidate.slug === product.slug) return true;
  return product.id != null && candidate.id != null && candidate.id === product.id;
}

function isLegacyListing(product: AlsoPopularCandidate) {
  return product.listingState === "Legacy" || product.listingOverride === "Force legacy" || product.listingOverride === "Legacy";
}

/** Published current-catalogue listing (Active or New). Public catalogue rows already match this. */
export function isAlsoPopularEligible(product: AlsoPopularCandidate) {
  const lifecycle = product.lifecycleStatus ?? product.publishStatus;
  if (lifecycle === "Archived" || lifecycle === "Draft") return false;
  return !isLegacyListing(product);
}

export function intendedAlsoPopularSlugs(chosenSlugs: readonly string[] | undefined, limit = ALSO_POPULAR_LIMIT) {
  const seen = new Set<string>();
  const intended: string[] = [];
  for (const raw of chosenSlugs ?? []) {
    const slug = raw.trim();
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    intended.push(slug);
    if (intended.length === limit) break;
  }
  return intended;
}

function replacementFrom<T extends AlsoPopularCandidate>(
  catalogue: readonly T[],
  product: { id?: number; slug: string; category: string },
  used: Set<string>,
  seed: string,
): T | undefined {
  const prefer = catalogue.filter((item) => item.category === product.category && !isSameProduct(item, product) && !used.has(item.slug));
  const pool = prefer.length
    ? prefer
    : catalogue.filter((item) => !isSameProduct(item, product) && !used.has(item.slug));
  return seededShuffle(pool, seed)[0];
}

/** Keep in sync with artifacts/claude-design/src/also-popular.ts */
export function resolveChosenAlsoPopular<T extends AlsoPopularCandidate>(
  product: { id?: number; slug: string },
  chosenSlugs: readonly string[] | undefined,
  catalogue: readonly T[],
  limit = ALSO_POPULAR_LIMIT,
): T[] {
  const bySlug = new Map<string, T>();
  for (const item of catalogue) {
    if (item.slug && !bySlug.has(item.slug)) bySlug.set(item.slug, item);
  }
  const chosen: T[] = [];
  for (const slug of intendedAlsoPopularSlugs(chosenSlugs, limit)) {
    const item = bySlug.get(slug);
    if (!item || isSameProduct(item, product) || !isAlsoPopularEligible(item)) continue;
    chosen.push(item);
  }
  return chosen;
}

export function resolveAlsoPopular<T extends AlsoPopularCandidate>(
  product: { id?: number; slug: string; category: string },
  chosenSlugs: readonly string[] | undefined,
  catalogue: readonly T[],
  limit = ALSO_POPULAR_LIMIT,
): T[] {
  const eligible = catalogue.filter((item) => isAlsoPopularEligible(item));
  const intended = intendedAlsoPopularSlugs(chosenSlugs, limit);
  if (intended.length === 0) {
    return seededShuffle(
      eligible.filter((item) => item.category === product.category && !isSameProduct(item, product)),
      product.slug || String(product.id ?? ""),
    ).slice(0, limit);
  }

  const bySlug = new Map<string, T>();
  for (const item of eligible) {
    if (item.slug && !bySlug.has(item.slug)) bySlug.set(item.slug, item);
  }
  const used = new Set<string>();
  const resolved: T[] = [];
  for (const slug of intended) {
    const item = bySlug.get(slug);
    const next = item && !isSameProduct(item, product)
      ? item
      : replacementFrom(eligible, product, used, `${product.slug}:${slug}`);
    if (!next) continue;
    resolved.push(next);
    used.add(next.slug);
  }
  return resolved;
}
