"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { CoverImage } from "../../components/CoverImage";
import { SeedGuideBanner } from "../../components/SeedGuideBanner";
import type { CatalogueArticle, PublicSiteSeedGuide } from "../../lib/catalogue";

function formatArticleDate(value: string) {
  return new Date(value).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
}

export function ArticlesContent({
  articles,
  seedGuide,
  intro,
}: {
  articles: CatalogueArticle[];
  seedGuide: PublicSiteSeedGuide;
  intro: ReactNode;
}) {
  const [articleCat, setArticleCat] = useState("All");
  const articleCats = ["All", ...Array.from(new Set(articles.flatMap((article) => article.tags).filter(Boolean)))];
  const filteredArticles = articleCat === "All" ? articles : articles.filter((article) => article.tags.includes(articleCat));

  return (
    <>
      <section style={{ background: "var(--sage)" }}>
        {intro}
      </section>

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
                  <div className="article-image">
                    {article.heroImageSrc ? <CoverImage src={article.heroImageSrc} alt="" sizes="(max-width: 900px) 100vw, 380px" /> : null}
                  </div>
                  <div className="article-copy">
                    <small>{[article.tags[0], formatArticleDate(article.publishedAt)].filter(Boolean).join(" · ")}</small>
                    <h2>{article.title}</h2>
                    <p>{article.excerpt}</p>
                    <Link href={`/articles/${article.slug}`} className="text-link">Read article <span className="visually-hidden">: {article.title}</span> <span aria-hidden="true">↗</span></Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <SeedGuideBanner seedGuide={seedGuide} />
    </>
  );
}
