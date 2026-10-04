/** 24 fills the three-column product grid evenly (eight full rows). */
export const PRODUCTS_PER_PAGE = 24;

/** The requested page from `?page=`; anything missing or invalid is page 1. */
export function pageFromSearchParams(params: URLSearchParams): number {
  const raw = params.get("page");
  if (!raw || !/^\d+$/.test(raw)) return 1;
  const page = Number(raw);
  return Number.isSafeInteger(page) && page >= 1 ? page : 1;
}

export type ProductPage<T> = {
  /** The page actually shown: the request clamped to the available pages. */
  page: number;
  pageCount: number;
  items: T[];
  /** 1-based position of the first and last item shown (0 when empty). */
  first: number;
  last: number;
  total: number;
};

/** Slice already-filtered results. Out-of-range requests show the last page. */
export function paginate<T>(items: T[], requestedPage: number, perPage = PRODUCTS_PER_PAGE): ProductPage<T> {
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(Math.max(1, Math.floor(requestedPage) || 1), pageCount);
  const start = (page - 1) * perPage;
  const shown = items.slice(start, start + perPage);
  return {
    page,
    pageCount,
    items: shown,
    first: shown.length ? start + 1 : 0,
    last: start + shown.length,
    total,
  };
}

/** Link to a page, keeping the current filters. Page 1 drops `page` so it matches the canonical URL. */
export function pageHref(pathname: string, params: URLSearchParams, page: number): string {
  const next = new URLSearchParams(params);
  if (page <= 1) next.delete("page");
  else next.set("page", String(page));
  const query = next.toString();
  return query ? `${pathname}?${query}` : pathname;
}

/** Page numbers to show, with null marking a gap: 1 … 4 5 6 … 12. */
export function pageNumbers(page: number, pageCount: number): Array<number | null> {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1);
  const wanted = new Set([1, pageCount, page - 1, page, page + 1]);
  const sorted = [...wanted].filter((value) => value >= 1 && value <= pageCount).sort((a, b) => a - b);
  const result: Array<number | null> = [];
  for (const value of sorted) {
    const previous = result[result.length - 1];
    if (typeof previous === "number" && value - previous > 1) result.push(null);
    result.push(value);
  }
  return result;
}
