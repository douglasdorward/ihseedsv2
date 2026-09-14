"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "../../components/Icon";
import { StatusPill } from "../../components/StatusPill";
import type { CatalogueCategory, CatalogueProduct } from "../../lib/catalogue";
import { productPublicPath } from "../../lib/catalogue-paths";
import { CategoryFilterControls, CategoryViewToggle } from "./CategoryControls";
import { getFactChips, listingImageOptions } from "./product-card-facts";

export function CategoryCatalogue({
  root,
  childCategories,
  products,
  categories,
}: {
  root: CatalogueCategory;
  childCategories: CatalogueCategory[];
  products: CatalogueProduct[];
  categories: CatalogueCategory[];
}) {
  const [activeGroup, setActiveGroup] = useState<number | "All">("All");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  const groups = [
    {
      label: "All",
      id: "All" as const,
      count: products.length,
      href: `/products/${root.slug}`,
    },
    ...childCategories.map((category) => ({
      label: category.name,
      id: category.id,
      count: products.filter((product) => product.subcategoryId === category.id).length,
      href: `/products/${root.slug}`,
    })),
  ];
  const visibleProducts = products
    .filter((product) => activeGroup === "All" || product.subcategoryId === activeGroup)
    .sort((first, second) => {
      if (first.details.featured !== second.details.featured) {
        return first.details.featured ? -1 : 1;
      }
      return (first.saleLines?.[0]?.sortOrder ?? 0) - (second.saleLines?.[0]?.sortOrder ?? 0);
    });
  const heading = activeGroup === "All"
    ? `${products.length} ${root.name.toLowerCase() || "lines"}`
    : groups.find((group) => group.id === activeGroup)?.label;

  return (
    <section style={{ background: "#FFFFFF" }}>
      <div className="page-content" style={{ maxWidth: 1180, margin: "0 auto", padding: "48px 40px 96px", display: "flex", flexDirection: "column", gap: 32 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, borderBottom: "2px solid var(--green)", paddingBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
            <h2 id="category-products-heading" style={{ margin: 0, fontSize: 30, fontWeight: 700, color: "var(--green)" }}>{heading}</h2>
            <CategoryViewToggle viewMode={viewMode} onToggle={() => setViewMode((mode) => mode === "grid" ? "table" : "grid")} />
          </div>
          {groups.length > 1 && (
            <CategoryFilterControls
              groups={groups}
              activeGroup={activeGroup}
              onSelect={(group) => setActiveGroup(group.id)}
            />
          )}
        </div>

          {visibleProducts.length > 0 ? (
            <>
              <div id="category-products-grid" className="category-card-grid" hidden={viewMode !== "grid"} style={{ display: viewMode === "grid" ? "grid" : "none", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 32 }}>
                {visibleProducts.map((product, index) => {
                  const subcategory = childCategories.find((category) => category.id === product.subcategoryId)?.name;
                  const chips = getFactChips(product, subcategory);
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
                        {subcategory && <div style={{ fontSize: 14, color: "#75766E" }}>{subcategory}</div>}
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
              <div id="category-products-table" className="comparison-table-wrapper" hidden={viewMode !== "table"}>
                <table className="comparison-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Sub-category</th>
                      <th>Stock</th>
                      <th>Min Rainfall</th>
                      <th>Soil Range</th>
                      <th>pH</th>
                      <th>Sowing Rate</th>
                      <th>Tolerances</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleProducts.map((product) => {
                      const subcategory = childCategories.find((category) => category.id === product.subcategoryId)?.name;
                      const details = product.details;
                      const rate = details.sowingRates?.[0];
                      return (
                        <tr key={product.id}>
                          <td style={{ fontWeight: 600 }}><Link href={productPublicPath(product, categories)} style={{ color: "inherit", textDecoration: "none" }}>{product.name}</Link></td>
                          <td>{subcategory || "—"}</td>
                          <td><StatusPill status={product.status} /></td>
                          <td>{details.rainfallMinMm ? `${details.rainfallMinMm} mm+` : "—"}</td>
                          <td>{details.soilRangeLightest && details.soilRangeHeaviest ? `${details.soilRangeLightest}–${details.soilRangeHeaviest}` : "—"}</td>
                          <td>{details.soilPhMin ? `${details.soilPhMin} ${details.soilPhScale}` : "—"}</td>
                          <td>{rate?.min && rate.max ? `${rate.min}–${rate.max} ${rate.unit}` : "—"}</td>
                          <td>{details.tolerance?.map((tolerance) => {
                            const name = tolerance.name === "Low pH" ? "P" : tolerance.name === "Waterlogging" ? "W" : tolerance.name === "Salinity" ? "S" : tolerance.name;
                            return tolerance.mild ? `Mild ${name}` : name;
                          }).join(" / ") || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <strong>No products match this filter.</strong>
              <span>Try another group or contact IH Seeds for current options.</span>
              <Link href="/contact" className="button button-primary">Ask about this category</Link>
            </div>
          )}
        </div>
      </section>
    );
}