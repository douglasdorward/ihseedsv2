import Link from "next/link";
import { Icon } from "./Icon";
import { pageHref, pageNumbers, type ListingPage } from "../lib/pagination";

/** Previous / numbered pages / Next links. Renders nothing when everything fits on one page. */
export function Pagination({
  current,
  pathname,
  searchParams,
  label,
}: {
  current: Pick<ListingPage<unknown>, "page" | "pageCount">;
  pathname: string;
  searchParams: URLSearchParams;
  label: string;
}) {
  if (current.pageCount <= 1) return null;
  const href = (page: number) => pageHref(pathname, searchParams, page);
  return (
    <nav className="listing-pagination" aria-label={label}>
      {current.page > 1 ? (
        <Link className="listing-pagination-step" href={href(current.page - 1)} scroll={false} rel="prev">
          <Icon name="chevron-left" size={16} /> Previous
        </Link>
      ) : (
        <span className="listing-pagination-step is-disabled" aria-hidden="true"><Icon name="chevron-left" size={16} /> Previous</span>
      )}
      <ol className="listing-pagination-pages">
        {pageNumbers(current.page, current.pageCount).map((value, index) => (
          <li key={value ?? `gap-${index}`}>
            {value === null ? (
              <span className="listing-pagination-gap" aria-hidden="true">…</span>
            ) : value === current.page ? (
              <span className="listing-pagination-page is-current" aria-current="page">{value}</span>
            ) : (
              <Link className="listing-pagination-page" href={href(value)} scroll={false} aria-label={`Page ${value}`}>{value}</Link>
            )}
          </li>
        ))}
      </ol>
      {current.page < current.pageCount ? (
        <Link className="listing-pagination-step" href={href(current.page + 1)} scroll={false} rel="next">
          Next <Icon name="chevron-right" size={16} />
        </Link>
      ) : (
        <span className="listing-pagination-step is-disabled" aria-hidden="true">Next <Icon name="chevron-right" size={16} /></span>
      )}
    </nav>
  );
}
