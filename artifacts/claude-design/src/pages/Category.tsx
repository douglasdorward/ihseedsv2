import React, { useState } from "react";
import { Link, useParams } from "../router";
import { imageOptions, productPath, useProducts } from "../hooks/useApi";
import { StatusPill } from "../components/ui";

const CATEGORY_MAP: Record<string, { light: string; bold: string; lead: string; count: string; rainfall: string; img: string }> = {
  mixes: { light: "Specialty", bold: "Mixes", lead: "Blended to order for the paddock they are going into. Designed for specific rainfall zones and grazing plans.", count: "18", rainfall: "400 - 800+ mm", img: imageOptions[0] },
  ryegrass: { light: "Pasture", bold: "Ryegrass", lead: "Annual, Italian and perennial types for high rainfall and irrigated country.", count: "21", rainfall: "500 - 900+ mm", img: imageOptions[1] },
  clovers: { light: "Sub &", bold: "Clovers", lead: "Sub, balansa, arrowleaf and Persian clovers across the rainfall range.", count: "16", rainfall: "300 - 700+ mm", img: imageOptions[2] },
  lucerne: { light: "Winter-active", bold: "Lucerne", lead: "Persistent hay and grazing stands selected across winter-activity classes.", count: "9", rainfall: "350 - 650+ mm", img: imageOptions[3] },
  serradella: { light: "Serradella &", bold: "Medic", lead: "Hard-seeded regenerating legumes for lighter soils and the wheatbelt.", count: "12", rainfall: "300 - 500+ mm", img: imageOptions[0] },
};

const MIX_GROUPS = [
  { label: "All", matcher: /.*/ },
  { label: "Specialist seed mixes", matcher: /souwest|maximix/i },
  { label: "Perennial mixes", matcher: /self regeneration/i },
  { label: "Forage hay mixes", matcher: /silahay/i },
];

export default function Category() {
  const { slug } = useParams<{ slug: string }>();
  const categoryMeta = CATEGORY_MAP[slug ?? ""];
  const { products } = useProducts();
  const [activeGroup, setActiveGroup] = useState("All");
  const productMatchers: Record<string, RegExp> = {
    mixes: /mix/i,
    ryegrass: /ryegrass/i,
    clovers: /clover/i,
    lucerne: /lucerne/i,
    serradella: /serradella|medic/i,
  };
  const categoryProducts = productMatchers[slug]?.test
    ? products.filter((product) => productMatchers[slug].test(product.name))
    : [];
  const groups = slug === "mixes" ? MIX_GROUPS : MIX_GROUPS.slice(0, 1);
  const activeMatcher = groups.find((group) => group.label === activeGroup)?.matcher ?? /.*/;
  const visibleProducts = categoryProducts.filter((product) => activeMatcher.test(product.name));

  if (!categoryMeta) {
    return (
      <section className="page-content" style={{ minHeight: "55vh", maxWidth: 1180, margin: "0 auto", padding: "96px 40px" }}>
        <h1 style={{ color: "var(--green)", fontSize: 48 }}>Category not found</h1>
        <p style={{ marginBottom: 28 }}>That category is not part of the current online range.</p>
        <Link href="/products" className="button button-primary">Browse available categories</Link>
      </section>
    );
  }

  return (
    <>
      <section style={{ background: "var(--sage)" }}>
        <div className="page-breadcrumb" style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 40px 12px", fontSize: 14, fontWeight: 600, color: "var(--muted)" }}>
          <Link href="/products" style={{ textDecoration: "none", color: "inherit" }}>Products</Link> / {categoryMeta.light} {categoryMeta.bold}
        </div>
        <div className="page-hero-grid" style={{ maxWidth: 1180, margin: "0 auto", padding: "12px 40px 72px", display: "grid", gridTemplateColumns: "minmax(0,1.15fr) minmax(0,1fr)", gap: 64, alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <h1 style={{ margin: 0, fontSize: 48, lineHeight: 1.2, fontWeight: 300, color: "var(--green)" }}>{categoryMeta.light} <span style={{ fontWeight: 700 }}>{categoryMeta.bold}</span></h1>
            <p style={{ margin: 0, fontSize: 18, lineHeight: 1.6, color: "var(--black-green)", maxWidth: "52ch" }}>{categoryMeta.lead}</p>
            <div style={{ display: "flex", gap: 32, flexWrap: "wrap", paddingTop: 8 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)" }}>Lines in this category</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--green)" }}>{categoryMeta.count}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)" }}>Rainfall range</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--green)" }}>{categoryMeta.rainfall}</div>
              </div>
            </div>
          </div>
          <div style={{ borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 10px rgba(29,40,28,0.10)", minHeight: 340, background: "#C5CCC5" }}>
            <div role="img" aria-label={categoryMeta.light} style={{ display: "block", width: "100%", height: 340, backgroundImage: `url(${categoryMeta.img})`, backgroundSize: "cover", backgroundPosition: "center" }}></div>
          </div>
        </div>
      </section>

      <section className="category-sticky" style={{ background: "#FFFFFF", borderBottom: "1px solid var(--line)", position: "sticky", top: 141, zIndex: 15 }}>
        <div className="chip-scroller" style={{ maxWidth: 1180, margin: "0 auto", padding: "20px 40px", display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          {groups.map((group) => (
            <button key={group.label} onClick={() => setActiveGroup(group.label)}
              style={{
                padding: "9px 20px", borderRadius: 999, fontSize: 14, fontWeight: 600, cursor: "pointer",
                border: `2px solid ${activeGroup === group.label ? "var(--green)" : "var(--line)"}`,
                background: activeGroup === group.label ? "var(--green)" : "transparent",
                color: activeGroup === group.label ? "#FFFFFF" : "var(--green)"
              }}
            >
              {group.label}
            </button>
          ))}
        </div>
      </section>

      <section style={{ background: "#FFFFFF" }}>
        <div className="page-content" style={{ maxWidth: 1180, margin: "0 auto", padding: "64px 40px 96px", display: "flex", flexDirection: "column", gap: 64 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 16, borderBottom: "2px solid var(--green)", paddingBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 30, fontWeight: 700, color: "var(--green)" }}>{activeGroup === "All" ? "Featured Mixes" : activeGroup}</h2>
              <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)" }}>All regions · {visibleProducts.length} lines</span>
            </div>
            
            {visibleProducts.length > 0 ? (
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
