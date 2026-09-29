import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CoverImage } from "../../../components/CoverImage";
import { ProductNewStamp } from "../../../components/NewStamp";
import { StatusPill } from "../../../components/StatusPill";
import { ArticleMarkdown } from "../../../lib/article-markdown";
import { getArticleBySlug, getCategories, getProducts } from "../../../lib/catalogue";
import { productPublicPath } from "../../../lib/catalogue-paths";
import { forSearchMetadata } from "../../../lib/search-metadata";
import { absoluteSiteUrl } from "../../../lib/site-url";
import { socialMetadata } from "../../../lib/social-metadata";
import { loadSiteSettings } from "../../../lib/site-settings";
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
  const settings = await loadSiteSettings();
  const canonicalHref = `/articles/${article.slug}`;
  const social = socialMetadata(title, description, canonicalHref, {
    type: "article",
    override: article.socialImage,
    hero: article.heroImageSrc,
    siteImage: settings.homepage.socialImageSrc,
    siteAssetId: settings.homepage.socialImageAssetId,
    socialTitle: forSearchMetadata(article.socialTitle?.trim() || title),
    socialDescription: forSearchMetadata(article.socialDescription?.trim() || description),
    alt: article.title,
  });
  return {
    title,
    description,
    alternates: { canonical: canonicalHref },
    robots: article.robotsIndex === false ? { index: false, follow: false } : undefined,
    ...social,
    openGraph: {
      ...social.openGraph,
      type: "article",
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
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
  const canonicalHref = `/articles/${article.slug}`;
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
      { "@type": "ListItem", position: 1, name: "Articles", item: absoluteSiteUrl("/articles") },
      { "@type": "ListItem", position: 2, name: article.title, item: absoluteSiteUrl(canonicalHref) },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([articleJsonLd, breadcrumbJsonLd]).replace(/</g, "\\u003c") }} />
      <section className="article-hero">
        {article.heroImageSrc ? <CoverImage src={article.heroImageSrc} alt="" sizes="100vw" /> : null}
        {article.heroImageSrc ? <div className="article-hero-scrim" aria-hidden="true" /> : null}
        <div className="page-content article-hero-copy">
          <nav aria-label="Breadcrumb" className="article-breadcrumb">
            <Link href="/articles">Articles</Link> › {article.tags[0] || "Article"}
          </nav>
          <h1>{article.title}</h1>
          <p>{[article.tags.join(" · "), formatArticleDate(article.publishedAt)].filter(Boolean).join(" · ")}</p>
        </div>
      </section>
      <section className="article-page">
        <div className="page-content article-layout">
          {article.excerpt ? <p className="article-lead">{article.excerpt}</p> : null}
          <ArticleMarkdown value={article.body} />
          {(article.pdfs ?? []).length > 0 && (
            <section className="article-downloads" aria-labelledby="article-downloads-heading">
              <h2 id="article-downloads-heading">Downloads</h2>
              <ul>
                {(article.pdfs ?? []).map((pdf) => (
                  <li key={pdf.slug}>
                    <a href={pdf.href}>{pdf.title}</a>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {linkedProducts.length > 0 && (
            <aside className="article-related" aria-labelledby="article-related-heading">
              <h2 id="article-related-heading">Related products</h2>
              <div className="also-popular-grid">
                {linkedProducts.map((product) => (
                  <Link key={product.id} href={productPublicPath(product, categories)} className="also-popular-card">
                    <div className="also-popular-image" style={hasProductPhoto(product) ? undefined : { backgroundImage: `url(${productCardImage(product)})` }}>
                      {hasProductPhoto(product) ? <CoverImage src={productCardImage(product)} alt={productImageAlt(product)} sizes="(max-width: 800px) 100vw, 360px" /> : <img className="product-fallback-logo" src="/ih-seeds-logo.png" alt="" width={178} height={117} />}
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
