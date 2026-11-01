import assert from "node:assert/strict";
import test from "node:test";
import {
  ALL_TOPICS,
  articleTopics,
  articlesForTopic,
  toListingArticle,
  topicFromSearchParams,
  topicHref,
} from "./article-listing.ts";
import { ARTICLES_PER_PAGE, pageFromSearchParams, pageHref, paginate } from "./pagination.ts";
import type { CatalogueArticle } from "./catalogue.ts";

function article(id: number, tags: string[]): CatalogueArticle {
  return {
    id,
    slug: `article-${id}`,
    title: `Article ${id}`,
    excerpt: `Excerpt ${id}`,
    body: "<p>Long body</p>".repeat(50),
    tags,
    heroImageSrc: `/api/media/${id}`,
    relatedProductSlugs: ["a"],
    pdfs: [{ slug: "p", title: "P", href: "/p.pdf" }],
    publishedAt: "2026-01-01T00:00:00.000Z",
    seoTitle: "SEO",
    seoDescription: "SEO description",
    socialTitle: "Social",
    socialDescription: "Social description",
    socialImage: "/social.jpg",
    robotsIndex: true,
    updatedAt: "2026-01-02T00:00:00.000Z",
  };
}

// 14 articles: even ids are "Sowing", every third is "Grazing".
const articles = Array.from({ length: 14 }, (_, index) => {
  const id = index + 1;
  return toListingArticle(article(id, [id % 2 === 0 ? "Sowing" : "Feed", ...(id % 3 === 0 ? ["Grazing"] : [])]));
});

test("listing articles keep only card fields", () => {
  const slim = toListingArticle(article(1, ["Sowing"]));
  assert.deepEqual(Object.keys(slim).sort(), ["excerpt", "heroImageSrc", "id", "publishedAt", "slug", "tags", "title"]);
});

test("articles show 12 per page", () => {
  assert.equal(ARTICLES_PER_PAGE, 12);
  const first = paginate(articles, 1, ARTICLES_PER_PAGE);
  assert.deepEqual([first.pageCount, first.items.length, first.first, first.last, first.total], [2, 12, 1, 12, 14]);
  const second = paginate(articles, 2, ARTICLES_PER_PAGE);
  assert.deepEqual([second.items.length, second.first, second.last], [2, 13, 14]);
});

test("out-of-range article pages show the last page", () => {
  assert.equal(paginate(articles, 9, ARTICLES_PER_PAGE).page, 2);
  assert.equal(paginate(articles.slice(0, 5), 3, ARTICLES_PER_PAGE).page, 1);
});

test("topic and page combine from the address", () => {
  const topics = articleTopics(articles);
  assert.deepEqual(topics, [ALL_TOPICS, "Feed", "Sowing", "Grazing"]);
  const params = new URLSearchParams("topic=Sowing&page=2");
  const topic = topicFromSearchParams(params, topics);
  assert.equal(topic, "Sowing");
  const current = paginate(articlesForTopic(articles, topic), pageFromSearchParams(params), ARTICLES_PER_PAGE);
  // Seven Sowing articles fit on one page, so page 2 clamps to page 1.
  assert.deepEqual([current.page, current.pageCount, current.total], [1, 1, 7]);
  assert.equal(pageHref("/articles", new URLSearchParams("topic=Feed"), 2), "/articles?topic=Feed&page=2");
});

test("unknown topics fall back to all articles", () => {
  const topics = articleTopics(articles);
  assert.equal(topicFromSearchParams(new URLSearchParams("topic=Nope"), topics), ALL_TOPICS);
  assert.equal(topicFromSearchParams(new URLSearchParams(""), topics), ALL_TOPICS);
});

test("changing topic returns to page 1", () => {
  const params = new URLSearchParams("topic=Feed&page=2");
  assert.equal(topicHref("/articles", params, "Grazing"), "/articles?topic=Grazing");
  assert.equal(topicHref("/articles", params, ALL_TOPICS), "/articles");
});
