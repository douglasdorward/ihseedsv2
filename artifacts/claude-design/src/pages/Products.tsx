import React, { useState } from "react";
import { Link } from "../router";
import { Icon } from "../components/ui";
import { useListCategories } from "@workspace/api-client-react";
import { useProducts } from "../hooks/useApi";

export default function Products() {
  const [filter, setFilter] = useState("All products");
  const { data: categories = [], isLoading, error, refetch } = useListCategories();
  const { products } = useProducts();

  const activeRootCategories = categories
    .filter(c => c.parentId === null && c.active && products.filter(p => p.category === c.name).length > 0)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const visibleCategories = filter === "All products"
    ? activeRootCategories
    : activeRootCategories.filter((category) => category.groupLabel === filter);

  const filters = ["All products", ...Array.from(new Set(activeRootCategories.map((category) => category.groupLabel).filter(Boolean)))];

  return (
    <>
      <section style={{ background: "var(--sage)" }}>
        <div className="page-hero-grid" style={{ maxWidth: 1180, margin: "0 auto", padding: "80px 40px", display: "grid", gridTemplateColumns: "minmax(0, 1.15fr) minmax(0, 1fr)", gap: 64, alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--green)" }}>Products</div>
            <h1 style={{ margin: 0, fontSize: 48, lineHeight: 1.2, fontWeight: 300, color: "var(--green)", maxWidth: "16ch" }}>Find the seed that fits your <span style={{ fontWeight: 700 }}>paddock</span></h1>
            <p style={{ margin: 0, fontSize: 18, lineHeight: 1.6, color: "var(--black-green)", maxWidth: "52ch" }}>Browse the current online range by pasture category, sourced and tested for Western Australian conditions, then order through your local rural reseller.</p>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", paddingTop: 8 }}>
              <Link href="/contact" className="button button-primary">Get in Touch</Link>
              <Link href="/contact" className="button button-outline">Find a reseller</Link>
            </div>
          </div>
          <div style={{ borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 10px rgba(29,40,28,0.10)" }}>
            <img src="https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=900&q=80" alt="Seed in a weathered hand" style={{ display: "block", width: "100%", height: 380, objectFit: "cover" }} />
          </div>
        </div>
      </section>

      <section style={{ background: "#FFFFFF" }}>
        <div className="page-content" style={{ maxWidth: 1180, margin: "0 auto", padding: "96px 40px 64px" }}>
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
          
          {isLoading ? (
            <div className="empty-state" aria-live="polite">
              <strong>Loading the current catalogue…</strong>
              <span>Product categories are being fetched from the IH Seeds catalogue.</span>
            </div>
          ) : error ? (
            <div className="empty-state" role="alert">
              <strong>Catalogue unavailable</strong>
              <span>Failed to load categories.</span>
              <button type="button" className="button button-primary" onClick={() => refetch()}>Try again</button>
            </div>
          ) : visibleCategories.length > 0 ? (
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
        </div>
      </section>

      <section style={{ background: "#FFFFFF" }}>
        <div className="page-wide" style={{ maxWidth: 1440, margin: "0 auto", padding: "32px 40px 96px" }}>
          <div className="feature-panel" style={{ minHeight: 480 }}>
            <div className="feature-copy">
              <h2 style={{ fontSize: 48 }}>Tested before it<br/><strong>ships</strong></h2>
              <p>Every line is true to type seed from credible growers, germination tested and blended to order. If you are unsure which species suits your rainfall zone, soil type and grazing plan, talk to us before you order — that advice is part of the seed.</p>
              <Link href="/resources" className="button button-outline" style={{ color: "#fff", borderColor: "#fff" }}>Download the Tech Sheet</Link>
            </div>
            <div className="feature-image" style={{ backgroundImage: `url(https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=900&q=80)`, backgroundPosition: "right" }} />
          </div>
        </div>
      </section>
    </>
  );
}
