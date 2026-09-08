"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "../../components/Icon";
import type { CatalogueCategory, CatalogueProduct } from "../../lib/catalogue";

export function ProductsCatalogue({ categories, products }: { categories: CatalogueCategory[]; products: CatalogueProduct[] }) {
  const [filter, setFilter] = useState("All products");

  const activeRootCategories = categories
    .filter(c => c.parentId === null && c.active && products.filter(p => p.category === c.name).length > 0)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const visibleCategories = filter === "All products"
    ? activeRootCategories
    : activeRootCategories.filter((category) => category.groupLabel === filter);

  const filters = ["All products", ...Array.from(new Set(activeRootCategories.map((category) => category.groupLabel).filter(Boolean)))];

  return (
    <>
      <div className="chip-scroller" style={{ display: "flex", flexWrap: "wrap", gap: 12, paddingBottom: 48 }}>
        {filters.map((f) => (
          <button 
            key={f} 
            onClick={() => setFilter(f)} 
            className={`filter-chip ${filter === f ? "active" : ""}`}
            style={{
              padding: "10px 22px", borderRadius: 999, fontSize: 15, fontWeight: 600, cursor: "pointer", 
              border: `2px solid ${filter === f ? "var(--green)" : "#C5CCC5"}`,
              background: filter === f ? "var(--green)" : "transparent",
              color: filter === f ? "#FFFFFF" : "var(--green)"
            }}
          >{f}</button>
        ))}
      </div>
      
      {visibleCategories.length > 0 ? (
        <div className="category-card-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 32 }}>
          {visibleCategories.map((c) => (
            <Link key={c.slug} href={`/products/${c.slug}`} style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 10px rgba(29,40,28,0.10)", position: "relative" }}>
                <img src={c.image} alt={c.name} style={{ display: "block", width: "100%", height: 240, objectFit: "cover" }} />
                <div style={{ position: "absolute", inset: "40% 0 0 0", background: "linear-gradient(to bottom, rgba(29,40,28,0) 0%, rgba(29,40,28,0.55) 100%)", pointerEvents: "none" }}></div>
                <div style={{ position: "absolute", bottom: 12, left: 16, right: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#FFFFFF" }}>{products.filter(p => p.category === c.name).length} {products.filter(p => p.category === c.name).length === 1 ? "line" : "lines"}</span>
                  <div className="icon-button" style={{ width: 40, height: 40, background: "var(--yellow)", border: "none" }}><Icon name="arrow-right" size={18} /></div>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--green)", lineHeight: 1.4 }}>{c.name}</div>
                <div style={{ fontSize: 16, lineHeight: 1.6, color: "var(--black-green)", maxWidth: "38ch" }}>{c.lead}</div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <strong>No published products in this view.</strong>
          <span>Choose another category group or check back when the catalogue is updated.</span>
        </div>
      )}
    </>
  );
}