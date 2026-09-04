import React, { useState } from "react";
import { Link, useParams } from "../router";
import { imageOptions, productPath, useProducts } from "../hooks/useApi";
import { StatusPill } from "../components/ui";
import { useListCategories } from "@workspace/api-client-react";

export default function Category() {
  const { slug } = useParams<{ slug: string }>();
  const { data: categories = [], isLoading: loadingCategories } = useListCategories();

  const categoryMeta = categories.find(c => c.slug === slug && c.parentId === null);
  const childCategories = categoryMeta ? categories.filter(c => c.parentId === categoryMeta.id && c.active).sort((a,b) => a.sortOrder - b.sortOrder) : [];

  const { products, loading: loadingProducts, error, retry } = useProducts();
  const [activeGroup, setActiveGroup] = useState<number | "All">("All");

  const visibleCategoryIds = new Set([
    ...(categoryMeta ? [categoryMeta.id] : []),
    ...childCategories.map((category) => category.id),
  ]);
  const categoryProducts = products.filter((product) =>
    product.subcategoryId != null && visibleCategoryIds.has(product.subcategoryId)
  );

  const groups = [{ label: "All", id: "All" as const }, ...childCategories.map(c => ({ label: c.name, id: c.id }))];

  const visibleProducts = categoryProducts
    .filter((product) => activeGroup === "All" || product.subcategoryId === activeGroup)
    .sort((first, second) => {
      const dateDifference = Date.parse(second.updatedAt ?? "") - Date.parse(first.updatedAt ?? "");
      return Number.isNaN(dateDifference) || dateDifference === 0 ? second.id - first.id : dateDifference;
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
            <div style={{ display: "flex", gap: 32, flexWrap: "wrap", paddingTop: 8 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)" }}>Lines in this category</div>
                 <div style={{ fontSize: 24, fontWeight: 700, color: "var(--green)" }}>{loading ? "—" : categoryProducts.length}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)" }}>Rainfall range</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--green)" }}>{categoryMeta?.rainfall || "—"}</div>
              </div>
            </div>
          </div>
          <div style={{ borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 10px rgba(29,40,28,0.10)", minHeight: 340, background: "#C5CCC5" }}>
             <div role="img" aria-label={categoryMeta?.name} style={{ display: "block", width: "100%", height: 340, backgroundImage: `url(${categoryMeta?.image})`, backgroundSize: "cover", backgroundPosition: "center" }}></div>
          </div>
        </div>
      </section>

      {groups.length > 1 && (
        <section className="category-sticky" style={{ background: "#FFFFFF", borderBottom: "1px solid var(--line)", position: "sticky", top: 141, zIndex: 15 }}>
          <div className="chip-scroller" style={{ maxWidth: 1180, margin: "0 auto", padding: "20px 40px", display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
            {groups.map((group) => (
              <button key={group.id} onClick={() => setActiveGroup(group.id)}
                style={{
                  padding: "9px 20px", borderRadius: 999, fontSize: 14, fontWeight: 600, cursor: "pointer",
                  border: `2px solid ${activeGroup === group.id ? "var(--green)" : "var(--line)"}`,
                  background: activeGroup === group.id ? "var(--green)" : "transparent",
                  color: activeGroup === group.id ? "#FFFFFF" : "var(--green)"
                }}
              >
                {group.label}
              </button>
            ))}
          </div>
        </section>
      )}

      <section style={{ background: "#FFFFFF" }}>
        <div className="page-content" style={{ maxWidth: 1180, margin: "0 auto", padding: "64px 40px 96px", display: "flex", flexDirection: "column", gap: 64 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 16, borderBottom: "2px solid var(--green)", paddingBottom: 12 }}>
               <h2 style={{ margin: 0, fontSize: 30, fontWeight: 700, color: "var(--green)" }}>{activeGroup === "All" ? categoryMeta?.name : groups.find(g => g.id === activeGroup)?.label}</h2>
              <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)" }}>All regions · {loading ? "—" : visibleProducts.length} lines</span>
            </div>
            
             {loading ? (
               <div className="empty-state" aria-live="polite">
                 <strong>Loading products…</strong>
                 <span>The latest published products are being fetched from the catalogue.</span>
               </div>
             ) : error ? (
               <div className="empty-state" role="alert">
                 <strong>Catalogue unavailable</strong>
                 <span>{error}</span>
                 <button type="button" className="button button-primary" onClick={retry}>Try again</button>
               </div>
             ) : visibleProducts.length > 0 ? (
            <div className="category-card-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 32 }}>
              {visibleProducts.map((p, index) => (
                <Link key={p.id} href={productPath(p)} style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 10px rgba(29,40,28,0.10)", minHeight: 220, background: "#C5CCC5", position: "relative" }}>
                    <div role="img" aria-label={p.name} style={{ display: "block", width: "100%", height: 220, backgroundImage: `url(${imageOptions[index % imageOptions.length]})`, backgroundSize: "cover", backgroundPosition: "center" }}></div>
                    <div style={{ position: "absolute", top: 12, left: 12 }}>
                      <StatusPill status={p.status} />
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: "var(--green)", lineHeight: 1.3 }}>{p.name}</div>
                    <div style={{ fontSize: 15, lineHeight: 1.5, color: "var(--black-green)" }}>{p.note}</div>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: "auto" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", background: "var(--sage)", padding: "4px 10px", borderRadius: 4 }}>{p.packSize}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", background: "var(--sage)", padding: "4px 10px", borderRadius: 4 }}>BARE</span>
                  </div>
                </Link>
              ))}
            </div>
            ) : (
              <div className="empty-state">
                <strong>No products match this filter.</strong>
                <span>Try another group or contact IH Seeds for current options.</span>
                <Link href="/contact" className="button button-primary">Ask about this category</Link>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
