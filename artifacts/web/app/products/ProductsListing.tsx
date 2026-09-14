"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { Icon } from "../../components/Icon";
import { StatusPill } from "../../components/StatusPill";
import type { CatalogueCategory, CatalogueProduct } from "../../lib/catalogue";
import { productPublicPath } from "../../lib/catalogue-paths";
import {
  END_USE_OPTIONS,
  EMPTY_FILTERS,
  filtersAreEmpty,
  filtersFromSearchParams,
  LIVESTOCK_OPTIONS,
  productMatchesFilters,
  RAINFALL_OPTIONS,
  searchParamsFromFilters,
  SOIL_OPTIONS,
  SOWING_CONTEXT_OPTIONS,
  TOLERANCE_OPTIONS,
  type ProductListingFilters,
} from "../../lib/product-filters";
import { getFactChips, listingImageOptions } from "./product-card-facts";

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
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <label className="product-filter-option">
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span>{label}</span>
    </label>
  );
}

export function ProductsListing({
  categories,
  products,
}: {
  categories: CatalogueCategory[];
  products: CatalogueProduct[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filters = useMemo(() => filtersFromSearchParams(searchParams), [searchParams]);

  const rootCategories = categories
    .filter((category) => category.parentId === null && category.active)
    .sort((first, second) => first.sortOrder - second.sortOrder || first.name.localeCompare(second.name));

  const visibleProducts = products
    .filter((product) => productMatchesFilters(product, filters, categories))
    .sort((first, second) => {
      if (first.details.featured !== second.details.featured) return first.details.featured ? -1 : 1;
      return first.name.localeCompare(second.name);
    });

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

      <FilterGroup title="Category">
        {rootCategories.map((category) => (
          <Checkbox
            key={category.id}
            checked={filters.category.includes(category.slug)}
            label={category.name}
            onChange={() => apply({ ...filters, category: toggleValue(filters.category, category.slug) })}
          />
        ))}
      </FilterGroup>

      <FilterGroup title="End-use">
        {END_USE_OPTIONS.map((value) => (
          <Checkbox
            key={value}
            checked={filters.endUse.includes(value)}
            label={value}
            onChange={() => apply({ ...filters, endUse: toggleValue(filters.endUse, value) })}
          />
        ))}
      </FilterGroup>

      <FilterGroup title="Livestock">
        {LIVESTOCK_OPTIONS.map((value) => (
          <Checkbox
            key={value}
            checked={filters.livestock.includes(value)}
            label={value}
            onChange={() => apply({ ...filters, livestock: toggleValue(filters.livestock, value) })}
          />
        ))}
      </FilterGroup>

      <FilterGroup title="Tolerance">
        {TOLERANCE_OPTIONS.map((value) => (
          <Checkbox
            key={value}
            checked={filters.tolerance.includes(value)}
            label={value}
            onChange={() => apply({ ...filters, tolerance: toggleValue(filters.tolerance, value) })}
          />
        ))}
      </FilterGroup>

      <FilterGroup title="Rainfall">
        <label className="product-filter-option">
          <span>Your annual rainfall</span>
          <select
            value={filters.rainfall ?? ""}
            onChange={(event) => apply({ ...filters, rainfall: event.target.value ? Number(event.target.value) : null })}
          >
            <option value="">Any</option>
            {RAINFALL_OPTIONS.map((value) => (
              <option key={value} value={value}>{value} mm</option>
            ))}
          </select>
        </label>
      </FilterGroup>

      <FilterGroup title="Features">
        <p className="product-filter-subtitle">Soil type</p>
        {SOIL_OPTIONS.map((option) => (
          <Checkbox
            key={option.value}
            checked={filters.soil.includes(option.value)}
            label={option.label}
            onChange={() => apply({ ...filters, soil: toggleValue(filters.soil, option.value) })}
          />
        ))}
        <p className="product-filter-subtitle">Sowing rate</p>
        {SOWING_CONTEXT_OPTIONS.map((value) => (
          <Checkbox
            key={value}
            checked={filters.sowing.includes(value)}
            label={value}
            onChange={() => apply({ ...filters, sowing: toggleValue(filters.sowing, value) })}
          />
        ))}
      </FilterGroup>
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
        <div className="product-filter-drawer">
          <div className="product-filter-drawer-panel">
            <div className="product-filter-sidebar-header">
              <h2>Filters</h2>
              <button type="button" className="product-filter-clear" onClick={() => setFiltersOpen(false)} aria-label="Close filters">Close</button>
            </div>
            {sidebar}
            <button type="button" className="button button-primary" onClick={() => setFiltersOpen(false)}>Show {visibleProducts.length} products</button>
          </div>
        </div>
      )}
      <aside className="product-filter-desktop">{sidebar}</aside>
      <div className="product-listing-results">
        {visibleProducts.length > 0 ? (
          <>
            <h2 className="product-listing-count">{visibleProducts.length} {visibleProducts.length === 1 ? "product" : "products"}</h2>
            <div className="category-card-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 32 }}>
            {visibleProducts.map((product, index) => {
              const chips = getFactChips(product);
              const tagline = product.details.tagline?.trim();
              return (
                <Link key={product.id} href={productPublicPath(product, categories)} style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 10px rgba(29,40,28,0.10)", minHeight: 220, background: "#C5CCC5", position: "relative" }}>
                    <div role="img" aria-label={product.name} style={{ display: "block", width: "100%", height: 220, backgroundImage: `url(${listingImageOptions[index % listingImageOptions.length]})`, backgroundSize: "cover", backgroundPosition: "center" }} />
                    <div style={{ position: "absolute", top: 12, left: 12 }}>
                      <StatusPill status={product.status} />
                    </div>
                    <div className="icon-button" aria-hidden="true" style={{ position: "absolute", right: 12, bottom: 12, width: 40, height: 40, background: "var(--yellow)", border: "none" }}>
                      <Icon name="arrow-right" size={18} />
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ fontSize: 20, fontWeight: 600, color: "var(--green)", lineHeight: 1.3 }}>{product.name}</div>
                    <div style={{ fontSize: 14, color: "#75766E" }}>{product.category}</div>
                    {tagline && <p className="product-card-tagline">{tagline}</p>}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {chips.map((chip, chipIndex) => (
                      <span key={chipIndex} className="fact-chip">{chip}</span>
                    ))}
                  </div>
                </Link>
              );
            })}
            </div>
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
