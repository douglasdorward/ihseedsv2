"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { CoverImage } from "../../components/CoverImage";
import { Pagination } from "../../components/Pagination";
import { SeedGuideBanner } from "../../components/SeedGuideBanner";
import type { PublicSiteSeedGuide } from "../../lib/catalogue";
import { articleTopics, articlesForTopic, topicFromSearchParams, topicHref, type ListingArticle } from "../../lib/article-listing";
import { ARTICLES_PER_PAGE, pageFromSearchParams, paginate } from "../../lib/pagination";
import { IMAGE_SIZES } from "../../lib/image-sizes";

function formatArticleDate(value: string) {
  return new Date(value).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
}

export function ArticlesContent({
  articles,
  seedGuide,
  intro,
}: {
  articles: ListingArticle[];
  seedGuide: PublicSiteSeedGuide;
  intro: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const articleCats = articleTopics(articles);
  const articleCat = topicFromSearchParams(searchParams, articleCats);
  const filteredArticles = articlesForTopic(articles, articleCat);
  const current = paginate(filteredArticles, pageFromSearchParams(searchParams), ARTICLES_PER_PAGE);

  const listRef = useRef<HTMLDivElement>(null);
  const shownPage = useRef(current.page);
  useEffect(() => {
    if (shownPage.current === current.page) return;
    shownPage.current = current.page;
    listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [current.page]);

  return (
    <>
      <section style={{ background: "var(--sage)" }}>
        {intro}
      </section>

      <section style={{ background: "#FFFFFF" }}>
        <div className="page-content article-listing" ref={listRef} style={{ maxWidth: 1180, margin: "0 auto", padding: "64px 40px 96px" }}>
          {articleCats.length > 1 && (
            <div className="chip-scroller" style={{ display: "flex", flexWrap: "wrap", gap: 12, paddingBottom: current.pageCount > 1 ? 20 : 48 }}>
              {articleCats.map((c) => (
                <button key={c} type="button" aria-pressed={articleCat === c} onClick={() => router.replace(topicHref(pathname, searchParams, c), { scroll: false })} style={{ padding: "9px 20px", borderRadius: 999, fontSize: 14, fontWeight: 600, cursor: "pointer", border: `2px solid ${articleCat === c ? "var(--green)" : "var(--line)"}`, background: articleCat === c ? "var(--green)" : "transparent", color: articleCat === c ? "#fff" : "var(--green)" }}>{c}</button>
              ))}
            </div>
          )}
          {current.pageCount > 1 && (
            <p className="article-listing-range">Showing {current.first}–{current.last} of {current.total}</p>
          )}
          {filteredArticles.length === 0 ? (
            <p className="empty-state" data-testid="status-articles-empty">No articles published yet.</p>
          ) : (
            <>
            <div className="article-grid">
              {current.items.map((article, index) => (
                <article className="article-card" key={article.id} data-testid={`card-article-${index}`}>
                  <div className="article-image">
                    {article.heroImageSrc ? <CoverImage src={article.heroImageSrc} alt="" sizes={IMAGE_SIZES.threeColumnCard} /> : null}
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
            <Pagination current={current} pathname={pathname} searchParams={searchParams} label="Article pages" />
            </>
          )}
        </div>
      </section>

      <SeedGuideBanner seedGuide={seedGuide} />
    </>
  );
}
