"use client";

import Link from "next/link";
import { Fragment, useState, type ReactNode } from "react";
import { Icon } from "../../components/Icon";
import type { CatalogueArticle, CatalogueCategory, CatalogueProduct, PublicSiteSeedGuide } from "../../lib/catalogue";
import { productPublicPath } from "../../lib/catalogue-paths";
import { publicMediaSrc } from "../../lib/site-settings";

const imageOptions = [
  "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1530507629858-e4977d30e9e0?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1499529112087-3cb3b73cec95?auto=format&fit=crop&w=900&q=80",
];

function formatArticleDate(value: string) {
  return new Date(value).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
}

export function ResourcesContent({
  articles,
  products,
  categories,
  seedGuide,
  intro,
}: {
  articles: CatalogueArticle[];
  products: CatalogueProduct[];
  categories: CatalogueCategory[];
  seedGuide: PublicSiteSeedGuide;
  intro: ReactNode;
}) {
  const [tab, setTab] = useState<"articles" | "sheets">("articles");
  const [articleCat, setArticleCat] = useState("All");
  const articleCats = ["All", ...Array.from(new Set(articles.flatMap((article) => article.tags).filter(Boolean)))];
  const filteredArticles = articleCat === "All" ? articles : articles.filter((article) => article.tags.includes(articleCat));

  return (
    <>
      <section style={{ background: "var(--sage)" }}>
        <Fragment key="intro">{intro}</Fragment>
        <div className="resource-tabs" style={{ maxWidth: 1180, margin: "0 auto", padding: "0 40px 32px", display: "flex", gap: 12 }}>
          <button onClick={() => setTab("articles")} style={{ padding: "12px 24px", borderRadius: 999, fontSize: 16, fontWeight: 700, cursor: "pointer", border: `2px solid ${tab === "articles" ? "var(--green)" : "transparent"}`, background: tab === "articles" ? "var(--green)" : "transparent", color: tab === "articles" ? "#fff" : "var(--green)" }}>Articles & Publications</button>
          <button onClick={() => setTab("sheets")} style={{ padding: "12px 24px", borderRadius: 999, fontSize: 16, fontWeight: 700, cursor: "pointer", border: `2px solid ${tab === "sheets" ? "var(--green)" : "transparent"}`, background: tab === "sheets" ? "var(--green)" : "transparent", color: tab === "sheets" ? "#fff" : "var(--green)" }}>Tech Sheets Hub</button>
        </div>
      </section>

      {tab === "articles" && (
        <section style={{ background: "#FFFFFF" }}>
          <div className="page-content" style={{ maxWidth: 1180, margin: "0 auto", padding: "64px 40px 96px" }}>
            {articleCats.length > 1 && (
              <div className="chip-scroller" style={{ display: "flex", flexWrap: "wrap", gap: 12, paddingBottom: 48 }}>
                {articleCats.map((c) => (
                  <button key={c} onClick={() => setArticleCat(c)} style={{ padding: "9px 20px", borderRadius: 999, fontSize: 14, fontWeight: 600, cursor: "pointer", border: `2px solid ${articleCat === c ? "var(--green)" : "var(--line)"}`, background: articleCat === c ? "var(--green)" : "transparent", color: articleCat === c ? "#fff" : "var(--green)" }}>{c}</button>
                ))}
              </div>
            )}
            {filteredArticles.length === 0 ? (
              <p className="empty-state" data-testid="status-articles-empty">No articles published yet.</p>
            ) : (
              <div className="article-grid">
                {filteredArticles.map((article, index) => (
                  <article className="article-card" key={article.id} data-testid={`card-article-${index}`}>
                    <div className="article-image" style={article.heroImageSrc ? { backgroundImage: `url(${article.heroImageSrc})` } : undefined} />
                    <div className="article-copy">
                      <small>{[article.tags[0], formatArticleDate(article.publishedAt)].filter(Boolean).join(" · ")}</small>
                      <h3>{article.title}</h3>
                      <p>{article.excerpt}</p>
                      <Link href={`/resources/${article.slug}`} className="text-link">Read article <span>↗</span></Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
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
                    <Link href={productPublicPath(product, categories)} className="button button-outline" style={{ padding: "8px 16px", minHeight: "auto", fontSize: 14 }}>View tech sheet</Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section style={{ background: "var(--sage)" }}>
        <div className="page-wide" style={{ maxWidth: 1440, margin: "0 auto", padding: "96px 40px" }}>
          <div className="guide-banner" style={{ backgroundImage: `linear-gradient(90deg, rgba(29,40,28,.92), rgba(29,40,28,.44)), url(${publicMediaSrc({ src: seedGuide.cardImageSrc, assetId: seedGuide.cardImageAssetId }) || imageOptions[3]})` }}>
            <div>
              <h2>{seedGuide.cardHeading}</h2>
              <a href={seedGuide.pdfPublicUrl} className="button button-light" style={{ display: "inline-block", textDecoration: "none" }} download>{seedGuide.cardButtonLabel}</a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
