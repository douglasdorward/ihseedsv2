import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductNewStamp } from "../../../components/NewStamp";
import { StatusPill } from "../../../components/StatusPill";
import { ArticleMarkdown } from "../../../lib/article-markdown";
import { getArticleBySlug, getCategories, getProducts } from "../../../lib/catalogue";
import { productPublicPath } from "../../../lib/catalogue-paths";
import { forSearchMetadata } from "../../../lib/search-metadata";
import { absoluteSiteUrl } from "../../../lib/site-url";
import { hasProductPhoto, productCardImage, productImageAlt } from "../../products/product-card-facts";

type Props = { params: Promise<{ slug: string }> };

function formatArticleDate(value: string) {
  return new Date(value).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
}

async function loadArticle(slug: string) {
  const article = await getArticleBySlug(slug);
  if (!article) notFound();
  return article;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await loadArticle(slug);
  const title = forSearchMetadata(article.seoTitle?.trim() || `${article.title} | IH Seeds`);
  const description = forSearchMetadata(article.seoDescription?.trim() || article.excerpt);
  const image = article.socialImage?.trim() || article.heroImageSrc;
  const canonicalHref = `/resources/${article.slug}`;
  return {
    title,
    description,
    alternates: { canonical: canonicalHref },
    robots: article.robotsIndex === false ? { index: false, follow: false } : undefined,
    openGraph: {
      type: "article",
      url: canonicalHref,
      title: forSearchMetadata(article.socialTitle?.trim() || title),
      description: forSearchMetadata(article.socialDescription?.trim() || description),
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      images: image ? [{ url: image, alt: article.title }] : undefined,
    },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const [article, products, categories] = await Promise.all([
    loadArticle(slug),
    getProducts(),
    getCategories(),
  ]);
  const canonicalHref = `/resources/${article.slug}`;
  const image = article.socialImage?.trim() || article.heroImageSrc;
  const bySlug = new Map(products.map((product) => [product.slug, product]));
  const linkedProducts = article.relatedProductSlugs
    .map((productSlug) => bySlug.get(productSlug))
    .filter((product): product is NonNullable<typeof product> => Boolean(product));
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: forSearchMetadata(article.title),
    description: forSearchMetadata(article.seoDescription || article.excerpt),
    image: image || undefined,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    author: { "@type": "Organization", name: "IH Seeds" },
    publisher: { "@type": "Organization", name: "IH Seeds" },
    url: absoluteSiteUrl(canonicalHref),
    mainEntityOfPage: absoluteSiteUrl(canonicalHref),
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Resources", item: absoluteSiteUrl("/resources") },
      { "@type": "ListItem", position: 2, name: article.title, item: absoluteSiteUrl(canonicalHref) },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([articleJsonLd, breadcrumbJsonLd]).replace(/</g, "\\u003c") }} />
      <section className="article-hero" style={article.heroImageSrc ? { backgroundImage: `linear-gradient(rgba(29,40,28,.55), rgba(29,40,28,.72)), url(${article.heroImageSrc})` } : undefined}>
        <div className="page-content article-hero-copy">
          <nav aria-label="Breadcrumb" className="article-breadcrumb">
            <Link href="/resources">Resources</Link> › {article.tags[0] || "Article"}
          </nav>
          <h1>{article.title}</h1>
          <p>{[article.tags.join(" · "), formatArticleDate(article.publishedAt)].filter(Boolean).join(" · ")}</p>
        </div>
      </section>
      <section className="article-page">
        <div className="page-content article-layout">
          {article.excerpt ? <p className="article-lead">{article.excerpt}</p> : null}
          <ArticleMarkdown value={article.body} />
          {linkedProducts.length > 0 && (
            <aside className="article-related" aria-labelledby="article-related-heading">
              <h2 id="article-related-heading">Related products</h2>
              <div className="also-popular-grid">
                {linkedProducts.map((product) => (
                  <Link key={product.id} href={productPublicPath(product, categories)} className="also-popular-card">
                    <div className="also-popular-image" role="img" aria-label={productImageAlt(product)} style={{ backgroundImage: `url(${productCardImage(product)})` }}>
                      {!hasProductPhoto(product) && <img className="product-fallback-logo" src="/ih-seeds-logo.png" alt="" />}
                      <StatusPill status={product.status} />
                      <ProductNewStamp listingState={product.listingState} />
                    </div>
                    <div className="also-popular-card-body">
                      <div>
                        <h3>{product.name}</h3>
                        {product.details.tagline?.trim() && <p>{product.details.tagline}</p>}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </aside>
          )}
        </div>
      </section>
    </>
  );
}
