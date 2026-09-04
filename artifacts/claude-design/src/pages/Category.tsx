import React, { useState, useEffect } from "react";
import { Link, useParams } from "../router";
import { imageOptions, productPath, useProducts } from "../hooks/useApi";
import { StatusPill } from "../components/ui";
import { useListCategories } from "@workspace/api-client-react";
import { getFactChips } from "../utils/CategoryUtils";

const slugifyCategory = (value: string) =>
  value.toLowerCase().replace(/&/g, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export default function Category() {
  const { slug } = useParams<{ slug: string }>();
  const { data: categories = [], isLoading: loadingCategories } = useListCategories();

  const categoryMeta = categories.find(c => c.parentId === null &&
    (c.slug === slug || slugifyCategory(c.name) === slug));
  const childCategories = categoryMeta ? categories.filter(c => c.parentId === categoryMeta.id && c.active).sort((a,b) => a.sortOrder - b.sortOrder) : [];

  const { products, loading: loadingProducts, error, retry } = useProducts();
  const [activeGroup, setActiveGroup] = useState<number | "All">("All");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  const [legacy, setLegacy] = useState<{ name: string }[]>([]);
  useEffect(() => {
    if (!categoryMeta?.name) return;
    fetch(`/api/products/category/${encodeURIComponent(categoryMeta.name)}/legacy`)
      .then(res => res.json())
      .then(data => setLegacy(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [categoryMeta?.name]);

  const visibleCategoryIds = new Set([
    ...(categoryMeta ? [categoryMeta.id] : []),
    ...childCategories.map((category) => category.id),
  ]);
  const categoryProducts = products.filter((product) =>
    product.category === categoryMeta?.name || (product.subcategoryId != null && visibleCategoryIds.has(product.subcategoryId))
  );

  const groups = [{ label: "All", id: "All" as const }, ...childCategories.map(c => ({ label: c.name, id: c.id }))];

  const visibleProducts = categoryProducts
    .filter((product) => activeGroup === "All" || product.subcategoryId === activeGroup)
    .sort((first, second) => {
      if (first.details.featured !== second.details.featured) return first.details.featured ? -1 : 1;
      // "featured" is not directly in schema, wait is it? 
      const firstOrder = first.saleLines?.[0]?.sortOrder ?? 0;
      const secondOrder = second.saleLines?.[0]?.sortOrder ?? 0;
      return firstOrder - secondOrder;
    });

  const loading = loadingCategories || loadingProducts;

  if (!loadingCategories && !categoryMeta) {
    return (
      <section className="page-content" style={{ minHeight: "55vh", maxWidth: 1180, margin: "0 auto", padding: "96px 40px" }}>
        <h1 style={{ color: "var(--green)", fontSize: 48 }}>Category not found</h1>
        <p style={{ marginBottom: 28 }}>That category is not part of the current online range.</p>
        <Link href="/products" className="button button-primary">Browse available categories</Link>
      </section>
    );
  }

  const titleWords = categoryMeta?.name ? categoryMeta.name.split(" ") : ["", ""];
  const lightPart = titleWords.length > 1 ? titleWords.slice(0, titleWords.length > 2 ? -2 : -1).join(" ") : titleWords[0];
  const boldPart = titleWords.length > 1 ? titleWords.slice(titleWords.length > 2 ? -2 : -1).join(" ") : "";

  return (
    <>
      <section style={{ background: "var(--sage)" }}>
        <div className="page-breadcrumb" style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 40px 12px", fontSize: 14, fontWeight: 600, color: "var(--muted)" }}>
          <Link href="/products" style={{ textDecoration: "none", color: "inherit" }}>Products</Link> / {loadingCategories ? "Loading..." : `${lightPart} ${boldPart}`.trim()}
        </div>
        <div className="page-hero-grid" style={{ maxWidth: 1180, margin: "0 auto", padding: "12px 40px 72px", display: "grid", gridTemplateColumns: "minmax(0,1.15fr) minmax(0,1fr)", gap: 64, alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {loadingCategories ? (
              <div style={{ height: 60, background: "rgba(0,0,0,0.05)", borderRadius: 8, width: "60%" }}></div>
            ) : (
              <h1 style={{ margin: 0, fontSize: 48, lineHeight: 1.2, fontWeight: 300, color: "var(--green)" }}>{lightPart} <span style={{ fontWeight: 700 }}>{boldPart}</span></h1>
            )}
            <p style={{ margin: 0, fontSize: 18, lineHeight: 1.6, color: "var(--black-green)", maxWidth: "52ch" }}>{categoryMeta?.lead}</p>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", paddingTop: 8 }}>
              <a href="/IH-Seeds-2026-Pasture-Seed-Guide.pdf" className="button button-primary" download>Download the 2026 Pasture Seed Guide</a>
            </div>
          </div>
          <div style={{ borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 10px rgba(29,40,28,0.10)", minHeight: 340, background: "#C5CCC5" }}>
             <div role="img" aria-label={categoryMeta?.name} style={{ display: "block", width: "100%", height: 340, backgroundImage: `url(${categoryMeta?.image || imageOptions[0]})`, backgroundSize: "cover", backgroundPosition: "center" }}></div>
          </div>
        </div>
      </section>

      {groups.length > 1 && (
        <section className="category-sticky" style={{ background: "#FFFFFF", borderBottom: "1px solid var(--line)", position: "sticky", top: 141, zIndex: 15 }}>
          <div className="chip-scroller" style={{ maxWidth: 1180, margin: "0 auto", padding: "20px 40px", display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
            {groups.map((group) => {
              const count = group.id === "All" ? categoryProducts.length : categoryProducts.filter(p => p.subcategoryId === group.id).length;
              return (
                <button key={group.id} onClick={() => setActiveGroup(group.id)}
                  style={{
                    padding: "9px 20px", borderRadius: 999, fontSize: 14, fontWeight: 600, cursor: "pointer",
                    border: `2px solid ${activeGroup === group.id ? "var(--green)" : "var(--line)"}`,
                    background: activeGroup === group.id ? "var(--green)" : "transparent",
                    color: activeGroup === group.id ? "#FFFFFF" : "var(--green)"
                  }}
                >
                  {group.label} ({count})
                </button>
              )
            })}
          </div>
        </section>
      )}

      <section style={{ background: "#FFFFFF" }}>
        <div className="page-content" style={{ maxWidth: 1180, margin: "0 auto", padding: "64px 40px 96px", display: "flex", flexDirection: "column", gap: 32 }}>
          
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "2px solid var(--green)", paddingBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 30, fontWeight: 700, color: "var(--green)" }}>{activeGroup === "All" ? `${visibleProducts.length} ${categoryMeta?.name?.toLowerCase() || 'lines'}` : groups.find(g => g.id === activeGroup)?.label}</h2>
            
            <button onClick={() => setViewMode(v => v === "grid" ? "table" : "grid")} className="button button-outline" style={{ padding: "6px 16px", fontSize: 14 }}>
              {viewMode === "grid" ? "Compare as a table" : "View as grid"}
            </button>
          </div>
          
           {loading ? (
             <div className="empty-state" aria-live="polite">
               <strong>Loading products…</strong>
             </div>
           ) : error ? (
             <div className="empty-state" role="alert">
               <strong>Catalogue unavailable</strong>
               <span>{error}</span>
               <button type="button" className="button button-primary" onClick={retry}>Try again</button>
             </div>
           ) : visibleProducts.length > 0 ? (
             viewMode === "grid" ? (
               <div className="category-card-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 32 }}>
                {visibleProducts.map((p, index) => {
                  const subCat = childCategories.find(c => c.id === p.subcategoryId)?.name;
                  const chips = getFactChips(p, subCat);
                  return (
                    <Link key={p.id} href={productPath(p)} style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", gap: 16 }}>
                      <div style={{ borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 10px rgba(29,40,28,0.10)", minHeight: 220, background: "#C5CCC5", position: "relative" }}>
                        <div role="img" aria-label={p.name} style={{ display: "block", width: "100%", height: 220, backgroundImage: `url(${imageOptions[index % imageOptions.length]})`, backgroundSize: "cover", backgroundPosition: "center" }}></div>
                        <div style={{ position: "absolute", top: 12, left: 12 }}>
                          <StatusPill status={p.status} />
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ fontSize: 20, fontWeight: 600, color: "var(--green)", lineHeight: 1.3 }}>{p.name}</div>
                        {subCat && <div style={{ fontSize: 14, color: "#75766E" }}>{subCat}</div>}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {chips.map((chip, i) => (
                          <span key={i} className="fact-chip">{chip}</span>
                        ))}
                      </div>
                      <div style={{ marginTop: "auto", fontSize: 14, fontWeight: 700, color: "var(--green)", textDecoration: "underline" }}>View product</div>
                    </Link>
                  )
                })}
              </div>
             ) : (
               <div className="comparison-table-wrapper">
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
                     {visibleProducts.map(p => {
                        const subCat = childCategories.find(c => c.id === p.subcategoryId)?.name;
                        const d = p.details;
                        const rate = d.sowingRates?.[0];
                        return (
                          <tr key={p.id}>
                            <td style={{ fontWeight: 600 }}><Link href={productPath(p)} style={{ color: "inherit", textDecoration: "none" }}>{p.name}</Link></td>
                            <td>{subCat || "—"}</td>
                            <td><StatusPill status={p.status} /></td>
                            <td>{d.rainfallMinMm ? `${d.rainfallMinMm} mm+` : "—"}</td>
                            <td>{d.soilRangeLightest && d.soilRangeHeaviest ? `${d.soilRangeLightest}–${d.soilRangeHeaviest}` : "—"}</td>
                            <td>{d.soilPhMin ? `${d.soilPhMin} ${d.soilPhScale}` : "—"}</td>
                            <td>{rate?.min && rate?.max ? `${rate.min}–${rate.max} ${rate.unit}` : "—"}</td>
                            <td>{d.tolerance?.map(t => { const n = t.name === "Low pH" ? "P" : t.name === "Waterlogging" ? "W" : t.name === "Salinity" ? "S" : t.name; return t.mild ? `Mild ${n}` : n; }).join(" / ") || "—"}</td>
                          </tr>
                        )
                     })}
                   </tbody>
                 </table>
               </div>
             )
          ) : (
            <div className="empty-state">
              <strong>No products match this filter.</strong>
              <span>Try another group or contact IH Seeds for current options.</span>
              <Link href="/contact" className="button button-primary">Ask about this category</Link>
            </div>
          )}
        </div>
      </section>
      
      {legacy.length > 0 && (
        <section id="catalogue" style={{ background: "#EFF1EE", padding: "64px 40px" }}>
          <div style={{ maxWidth: 1180, margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 32, marginBottom: 48 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 30, fontWeight: 700, color: "var(--green)", marginBottom: 12 }}>Also in our catalogue</h3>
                <p style={{ margin: 0, fontSize: 16, color: "var(--black-green)" }}>These lines are not on our current price list. Ask us about availability or a custom mix.</p>
              </div>
              <Link href="/contact" className="button button-outline" style={{ background: "transparent" }}>Contact us</Link>
            </div>
            <div className="legacy-grid">
              {/* Grouping legacy names if we had sub-category, but we only have category. Let's group by empty string since we don't have subcat. */}
              <div className="legacy-group">
                <h6>{categoryMeta?.name} Legacy Lines</h6>
                <ul>
                  {legacy.map((item, index) => (
                    <li key={`${item.name}-${index}`}>{item.name}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
