import React, { useState } from "react";
import { Link } from "../router";
import { articleSeed, imageOptions, productPath, useProducts } from "../hooks/useApi";
import { Icon } from "../components/ui";

export default function Resources() {
  const [tab, setTab] = useState<"articles" | "sheets">("articles");
  const [articleCat, setArticleCat] = useState("All");
  const { products } = useProducts();
  
  const articleCats = ["All", ...Array.from(new Set(articleSeed.map(a => a.category)))];
  const filteredArticles = articleCat === "All" ? articleSeed : articleSeed.filter(a => a.category === articleCat);

  return (
    <>
      <section style={{ background: "var(--sage)" }}>
        <div className="page-content resource-intro" style={{ maxWidth: 1180, margin: "0 auto", padding: "64px 40px 40px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--green)" }}>Resources</div>
          <h1 style={{ margin: 0, fontSize: 48, lineHeight: 1.2, fontWeight: 300, color: "var(--green)" }}>Advice, guides and <span style={{ fontWeight: 700 }}>tech sheets</span></h1>
          <p style={{ margin: 0, fontSize: 18, lineHeight: 1.6, color: "var(--black-green)", maxWidth: "64ch" }}>Everything we publish on sowing, feed planning and seasonal timing, plus a downloadable tech sheet for every mix and variety we stock.</p>
        </div>
        <div className="resource-tabs" style={{ maxWidth: 1180, margin: "0 auto", padding: "0 40px 32px", display: "flex", gap: 12 }}>
          <button 
            onClick={() => setTab("articles")}
            style={{ padding: "12px 24px", borderRadius: 999, fontSize: 16, fontWeight: 700, cursor: "pointer", border: `2px solid ${tab === "articles" ? "var(--green)" : "transparent"}`, background: tab === "articles" ? "var(--green)" : "transparent", color: tab === "articles" ? "#fff" : "var(--green)" }}
          >Articles & Publications</button>
          <button 
            onClick={() => setTab("sheets")}
            style={{ padding: "12px 24px", borderRadius: 999, fontSize: 16, fontWeight: 700, cursor: "pointer", border: `2px solid ${tab === "sheets" ? "var(--green)" : "transparent"}`, background: tab === "sheets" ? "var(--green)" : "transparent", color: tab === "sheets" ? "#fff" : "var(--green)" }}
          >Tech Sheets Hub</button>
        </div>
      </section>

      {tab === "articles" && (
        <section style={{ background: "#FFFFFF" }}>
          <div className="page-content" style={{ maxWidth: 1180, margin: "0 auto", padding: "64px 40px 96px" }}>
            <div className="chip-scroller" style={{ display: "flex", flexWrap: "wrap", gap: 12, paddingBottom: 48 }}>
              {articleCats.map((c) => (
                <button 
                  key={c} onClick={() => setArticleCat(c)}
                  style={{ padding: "9px 20px", borderRadius: 999, fontSize: 14, fontWeight: 600, cursor: "pointer", border: `2px solid ${articleCat === c ? "var(--green)" : "var(--line)"}`, background: articleCat === c ? "var(--green)" : "transparent", color: articleCat === c ? "#fff" : "var(--green)" }}
                >{c}</button>
              ))}
            </div>
            
            <div className="article-grid">
              {filteredArticles.map((article, index) => (
                <article className="article-card" key={index} data-testid={`card-article-${index}`}>
                  <div className="article-image" style={{ backgroundImage: `url(${article.image})` }} />
                  <div className="article-copy">
                    <small>{article.category} · {article.date}</small>
                    <h3>{article.title}</h3>
                    <p>{article.excerpt}</p>
                    <Link href="/contact" className="text-link">Ask for advice <span>↗</span></Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {tab === "sheets" && (
        <section style={{ background: "#FFFFFF" }}>
          <div className="page-content" style={{ maxWidth: 1180, margin: "0 auto", padding: "64px 40px 96px" }}>
            <div style={{ display: "flex", flexDirection: "column", border: "1px solid var(--line)", borderRadius: 16, overflow: "hidden" }}>
              {products.map((product, index) => (
                <div className="tech-sheet-row" key={product.id} style={{ display: "grid", gridTemplateColumns: "44px minmax(0,2fr) minmax(0,1.2fr) 120px 160px", gap: 20, alignItems: "center", padding: "18px 24px", borderBottom: index === products.length - 1 ? "none" : "1px solid var(--line)" }}>
                  <span style={{ color: "var(--green)", display: "flex" }}><Icon name="file-text" size={22} /></span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "var(--green)" }}>{product.name}</div>
                    <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.45 }}>{product.details.tagline}</div>
                  </div>
                  <div style={{ fontSize: 14, color: "var(--black-green)" }}>{product.packSize}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>2026 range</div>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <Link href={productPath(product)} className="button button-outline" style={{ padding: "8px 16px", minHeight: "auto", fontSize: 14 }}>View tech sheet</Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section style={{ background: "var(--sage)" }}>
        <div className="page-wide" style={{ maxWidth: 1440, margin: "0 auto", padding: "96px 40px" }}>
          <div className="guide-banner" style={{ backgroundImage: `linear-gradient(90deg, rgba(29,40,28,.92), rgba(29,40,28,.44)), url(${imageOptions[3]})` }}>
            <div>
              <h2>Species, sowing rates and regional advice for the season ahead.</h2>
              <a href="/IH-Seeds-2026-Pasture-Seed-Guide.pdf" className="button button-light" style={{ display: "inline-block", textDecoration: "none" }} download>Download the 2026 Pasture Seed Guide (PDF)</a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
