"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CoverImage } from "../../components/CoverImage";
import { Icon } from "../../components/Icon";
import { ProductNewStamp } from "../../components/NewStamp";
import { StatusPill } from "../../components/StatusPill";
import type { CatalogueCategory } from "../../lib/catalogue";
import type { ListingProduct } from "../../lib/product-listing";
import { productPublicPath } from "../../lib/catalogue-paths";
import {
  catalogueFilterOptions,
  EMPTY_FILTERS,
  filtersAreEmpty,
  filtersFromSearchParams,
  isFilterOptionEnabled,
  productMatchesFilters,
  searchParamsFromFilters,
  SOIL_OPTIONS,
  type FilterOptionDimension,
  type ProductListingFilters,
} from "../../lib/product-filters";
import { pageFromSearchParams, pageHref, pageNumbers, paginate } from "../../lib/product-pagination";
import { getFactChips, hasProductPhoto, productCardImage, productImageAlt } from "./product-card-facts";

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="product-filter-group">
      <legend>{title}</legend>
      {children}
    </fieldset>
  );
}

function Checkbox({
  checked,
  disabled = false,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <label className={`product-filter-option${disabled ? " is-disabled" : ""}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={onChange} />
      <span>{label}</span>
    </label>
  );
}

export function ProductsListing({
  categories,
  products,
}: {
  categories: CatalogueCategory[];
  products: ListingProduct[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filters = useMemo(() => filtersFromSearchParams(searchParams), [searchParams]);

  const rootCategories = useMemo(
    () => categories
      .filter((category) => category.parentId === null && category.active)
      .sort((first, second) => first.name.localeCompare(second.name)),
    [categories],
  );

  const options = useMemo(
    () => catalogueFilterOptions(products, categories),
    [products, categories],
  );

  const categoryBySlug = useMemo(
    () => new Map(rootCategories.map((category) => [category.slug, category])),
    [rootCategories],
  );

  const soilLabelByValue = useMemo(
    () => new Map<string, string>(SOIL_OPTIONS.map((option) => [option.value, option.label])),
    [],
  );

  function optionEnabled(dimension: FilterOptionDimension, value: string | number) {
    return isFilterOptionEnabled(products, categories, filters, dimension, value);
  }

  const visibleProducts = products
    .filter((product) => productMatchesFilters(product, filters, categories))
    .sort((first, second) => first.name.localeCompare(second.name));

  // Filters always run over the whole catalogue; paging only slices the matches.
  const current = paginate(visibleProducts, pageFromSearchParams(searchParams));
  const resultsRef = useRef<HTMLDivElement>(null);
  const shownPage = useRef(current.page);
  useEffect(() => {
    if (shownPage.current === current.page) return;
    shownPage.current = current.page;
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [current.page]);

  function apply(next: ProductListingFilters) {
    const params = searchParamsFromFilters(next);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  const sidebar = (
    <form className="product-filter-sidebar" onSubmit={(event) => event.preventDefault()} aria-label="Product filters">
      <div className="product-filter-sidebar-header">
        <h2>Filters</h2>
        {!filtersAreEmpty(filters) && (
          <button type="button" className="product-filter-clear" onClick={() => apply(EMPTY_FILTERS)}>
            Clear all
          </button>
        )}
      </div>

      {options.category.length > 0 && (
        <FilterGroup title="Category">
          {options.category.map((slug) => {
            const category = categoryBySlug.get(slug);
            if (!category) return null;
            return (
              <Checkbox
                key={slug}
                checked={filters.category.includes(slug)}
                disabled={!optionEnabled("category", slug)}
                label={category.name}
                onChange={() => apply({ ...filters, category: toggleValue(filters.category, slug) })}
              />
            );
          })}
        </FilterGroup>
      )}

      {options.endUse.length > 0 && (
        <FilterGroup title="End-use">
          {options.endUse.map((value) => (
            <Checkbox
              key={value}
              checked={filters.endUse.includes(value)}
              disabled={!optionEnabled("endUse", value)}
              label={value}
              onChange={() => apply({ ...filters, endUse: toggleValue(filters.endUse, value) })}
            />
          ))}
        </FilterGroup>
      )}

      {options.livestock.length > 0 && (
        <FilterGroup title="Livestock">
          {options.livestock.map((value) => (
            <Checkbox
              key={value}
              checked={filters.livestock.includes(value)}
              disabled={!optionEnabled("livestock", value)}
              label={value}
              onChange={() => apply({ ...filters, livestock: toggleValue(filters.livestock, value) })}
            />
          ))}
        </FilterGroup>
      )}

      {options.tolerance.length > 0 && (
        <FilterGroup title="Tolerance">
          {options.tolerance.map((value) => (
            <Checkbox
              key={value}
              checked={filters.tolerance.includes(value)}
              disabled={!optionEnabled("tolerance", value)}
              label={value}
              onChange={() => apply({ ...filters, tolerance: toggleValue(filters.tolerance, value) })}
            />
          ))}
        </FilterGroup>
      )}

      {options.rainfall.length > 0 && (
        <FilterGroup title="Rainfall">
          <label className="product-filter-option">
            <span>Your annual rainfall</span>
            <select
              value={filters.rainfall ?? ""}
              onChange={(event) => apply({ ...filters, rainfall: event.target.value ? Number(event.target.value) : null })}
            >
              <option value="">Any</option>
              {options.rainfall.map((value) => (
                <option key={value} value={value} disabled={!optionEnabled("rainfall", value)}>
                  {value} mm
                </option>
              ))}
            </select>
          </label>
        </FilterGroup>
      )}

      {(options.soil.length > 0 || options.sowing.length > 0) && (
        <FilterGroup title="Features">
          {options.soil.length > 0 && (
            <>
              <p className="product-filter-subtitle">Soil type</p>
              {options.soil.map((value) => (
                <Checkbox
                  key={value}
                  checked={filters.soil.includes(value)}
                  disabled={!optionEnabled("soil", value)}
                  label={soilLabelByValue.get(value) ?? value}
                  onChange={() => apply({ ...filters, soil: toggleValue(filters.soil, value) })}
                />
              ))}
            </>
          )}
          {options.sowing.length > 0 && (
            <>
              <p className="product-filter-subtitle">Sowing rate</p>
              {options.sowing.map((value) => (
                <Checkbox
                  key={value}
                  checked={filters.sowing.includes(value)}
                  disabled={!optionEnabled("sowing", value)}
                  label={value}
                  onChange={() => apply({ ...filters, sowing: toggleValue(filters.sowing, value) })}
                />
              ))}
            </>
          )}
        </FilterGroup>
      )}
    </form>
  );

  return (
    <div className="product-listing-layout">
      <button
        type="button"
        className="product-filter-toggle button button-outline"
        onClick={() => setFiltersOpen(true)}
      >
        Filters
      </button>
      {filtersOpen && (
        <div className="product-filter-drawer" onClick={() => setFiltersOpen(false)}>
          <div className="product-filter-drawer-panel" onClick={(event) => event.stopPropagation()}>
            <div className="product-filter-sidebar-header">
              <h2>Filters</h2>
              <div className="product-filter-drawer-actions">
                <button type="button" className="button button-primary" onClick={() => setFiltersOpen(false)}>
                  Show {visibleProducts.length} {visibleProducts.length === 1 ? "product" : "products"}
                </button>
                <button
                  type="button"
                  className="product-filter-clear"
                  onClick={() => apply(EMPTY_FILTERS)}
                  disabled={filtersAreEmpty(filters)}
                >
                  Clear
                </button>
              </div>
            </div>
            {sidebar}
          </div>
        </div>
      )}
      <aside className="product-filter-desktop">{sidebar}</aside>
      <div className="product-listing-results" ref={resultsRef}>
        {visibleProducts.length > 0 ? (
          <>
            <h2 className="product-listing-count">
              {visibleProducts.length} {visibleProducts.length === 1 ? "product" : "products"}
              {current.pageCount > 1 && <span className="product-listing-range"> · showing {current.first}–{current.last}</span>}
            </h2>
            <div className="category-card-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 32 }}>
            {current.items.map((product) => {
              const chips = getFactChips(product);
              const tagline = product.details.tagline?.trim();
              const hasPhoto = hasProductPhoto(product);
              return (
                <Link
                  key={product.id}
                  href={productPublicPath(product, categories)}
                  className={`catalogue-product-card${hasPhoto ? "" : " is-photo-missing"}`}
                >
                  <div className="catalogue-product-media">
                    <div className="catalogue-product-image">
                      {hasPhoto ? <CoverImage src={productCardImage(product)} alt={productImageAlt(product)} sizes="(max-width: 700px) 100vw, (max-width: 1100px) 46vw, 360px" /> : null}
                    </div>
                    {!hasPhoto && <img className="product-fallback-logo" src="/ih-seeds-logo.png" alt={`${product.name} — product image unavailable`} width={178} height={117} />}
                    <div style={{ position: "absolute", top: 12, left: 12 }}>
                      <StatusPill status={product.status} />
                    </div>
                    <ProductNewStamp listingState={product.listingState} />
                    <div className="icon-button catalogue-product-arrow" aria-hidden="true">
                      <Icon name="arrow-right" size={18} />
                    </div>
                  </div>
                  <div className="catalogue-product-details">
                    <div className="catalogue-product-name">{product.name}</div>
                    <div className="catalogue-product-category">{product.category}</div>
                    {tagline && <p className="product-card-tagline">{tagline}</p>}
                  </div>
                  <div className="catalogue-product-facts">
                    {chips.map((chip, chipIndex) => (
                      <span key={chipIndex} className="fact-chip">{chip}</span>
                    ))}
                  </div>
                </Link>
              );
            })}
            </div>
            {current.pageCount > 1 && (
              <nav className="product-pagination" aria-label="Product pages">
                {current.page > 1 ? (
                  <Link className="product-pagination-step" href={pageHref(pathname, searchParams, current.page - 1)} scroll={false} rel="prev">
                    <Icon name="chevron-left" size={16} /> Previous
                  </Link>
                ) : (
                  <span className="product-pagination-step is-disabled" aria-hidden="true"><Icon name="chevron-left" size={16} /> Previous</span>
                )}
                <ol className="product-pagination-pages">
                  {pageNumbers(current.page, current.pageCount).map((value, index) => (
                    <li key={value ?? `gap-${index}`}>
                      {value === null ? (
                        <span className="product-pagination-gap" aria-hidden="true">…</span>
                      ) : value === current.page ? (
                        <span className="product-pagination-page is-current" aria-current="page">{value}</span>
                      ) : (
                        <Link className="product-pagination-page" href={pageHref(pathname, searchParams, value)} scroll={false} aria-label={`Page ${value}`}>{value}</Link>
                      )}
                    </li>
                  ))}
                </ol>
                {current.page < current.pageCount ? (
                  <Link className="product-pagination-step" href={pageHref(pathname, searchParams, current.page + 1)} scroll={false} rel="next">
                    Next <Icon name="chevron-right" size={16} />
                  </Link>
                ) : (
                  <span className="product-pagination-step is-disabled" aria-hidden="true">Next <Icon name="chevron-right" size={16} /></span>
                )}
              </nav>
            )}
          </>
        ) : (
          <div className="product-listing-empty">
            <div className="product-listing-empty-icon" aria-hidden="true">
              <Icon name="search" size={28} />
            </div>
            <h3>Nothing in the catalogue matches that combination</h3>
            <p>Loosen a filter, or talk to us about a custom mix for your rainfall, soil and livestock.</p>
            <div className="product-listing-empty-actions">
              <button type="button" className="button button-primary" onClick={() => apply(EMPTY_FILTERS)}>Clear filters</button>
              <Link href="/contact" className="button button-outline">Ask about a mix</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
