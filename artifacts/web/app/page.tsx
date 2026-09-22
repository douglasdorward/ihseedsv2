import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "../components/Icon";
import { ProductNewStamp } from "../components/NewStamp";
import { StatusPill } from "../components/StatusPill";
import { getArticles, getCategories, getProducts, type CatalogueArticle } from "../lib/catalogue";
import { CATALOGUE_INDEX_PATH, productPublicPath } from "../lib/catalogue-paths";
import { HomeHero } from "../components/HomeHero";
import { expandProductCount, FALLBACK_SITE_SETTINGS, loadSiteSettings, publicMediaSrc, resolveBestSellers, resolveHomepageHeroImages } from "../lib/site-settings";
import { hasProductPhoto, productCardImage, productImageAlt } from "./products/product-card-facts";

export const metadata: Metadata = {
  title: "IH Seeds | Western Australia's Pasture Seed Specialists",
  description: "Western Australian pasture seed, proven varieties, regional mixes and practical advice from the independently owned IH Seeds team.",
  alternates: { canonical: "/" },
};

const ABOUT_IMAGE = "https://images.unsplash.com/photo-1530507629858-e4977d30e9e0?auto=format&fit=crop&w=900&q=80";

function formatArticleDate(value: string) {
  return new Date(value).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
}

function latestArticles(articles: CatalogueArticle[], count = 3) {
  return [...articles]
    .sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt) || right.id - left.id)
    .slice(0, count);
}

export default async function Home() {
  const [products, categories, settings, articles] = await Promise.all([getProducts(), getCategories(), loadSiteSettings(), getArticles()]);
  const seedShedArticles = latestArticles(articles);
  const visibleProducts = resolveBestSellers(settings.homepage.bestSellerSlugs, products);
  const heroBody = expandProductCount(settings.homepage.heroBody, products.length);
  const guideImage = publicMediaSrc({ src: settings.seedGuide.cardImageSrc, assetId: settings.seedGuide.cardImageAssetId });

  return (
    <>
      <HomeHero
        eyebrow={settings.homepage.heroEyebrow}
        heading={settings.homepage.heroHeading}
        body={heroBody}
        images={resolveHomepageHeroImages(settings.homepage)}
        slideshow={settings.homepage.heroSlideshow}
      />

      <section className="pillars" aria-label="Why IH Seeds">
        <div className="three-column">
          <div className="pillar"><Icon name="map-pin" size={27} /><h3>Regional expertise</h3><p>Local conditions, understood and applied. Sixty years of sowing across every WA rainfall zone.</p></div>
          <div className="pillar"><Icon name="sprout" size={27} /><h3>Proven performance</h3><p>Varieties and mixes proven over generations across Australia, with trial data behind them.</p></div>
          <div className="pillar"><Icon name="users" size={27} /><h3>Partnership</h3><p>Confidence before the order. Support after it — through your local rural reseller.</p></div>
        </div>
      </section>

      <section id="products" className="section section-subtle">
        <div className="content-width">
          <div className="section-heading">
            <h2><span>Best</span> Sellers</h2>
            <Link href={CATALOGUE_INDEX_PATH} className="button button-outline" data-testid="button-view-all">View all products</Link>
          </div>
          {visibleProducts.length === 0 ? (
            <div className="empty-state" data-testid="status-products-empty">No products match.</div>
          ) : (
            <div className="product-grid">
              {visibleProducts.map((product) => (
                <Link href={productPublicPath(product, categories)} className="product-card" style={{ textDecoration: "none", color: "inherit" }} key={product.id} data-testid={`card-product-${product.id}`}>
                  <div className="product-image" role="img" aria-label={productImageAlt(product)} style={{ backgroundImage: `linear-gradient(180deg, transparent, rgba(29,40,28,.72)), url(${productCardImage(product)})` }}>
                    {!hasProductPhoto(product) && <img className="product-fallback-logo" src="/ih-seeds-logo.png" alt="" />}
                    <StatusPill status={product.status} />
                    <ProductNewStamp listingState={product.listingState} />
                  </div>
                  <div className="product-details">
                    <h3>{product.name}</h3>
                    <p className="product-card-tagline">{product.details.tagline}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section id="about" className="section about-section">
        <div className="feature-panel">
          <div className="feature-image" style={{ backgroundImage: `linear-gradient(90deg, rgba(12,88,60,.12), rgba(12,88,60,.02)), url(${ABOUT_IMAGE})` }} />
          <div className="feature-copy">
            <h2><span>About</span> Us</h2>
            <p>{settings.homepage.aboutBody || FALLBACK_SITE_SETTINGS.homepage.aboutBody}</p>
            <Link href="/about" className="button button-outline" style={{ color: "#fff", borderColor: "#fff" }} data-testid="button-learn-about">Learn more about IH Seeds</Link>
          </div>
        </div>
      </section>

      {seedShedArticles.length > 0 && (
        <section id="seed-shed" className="section seed-shed-section" aria-labelledby="seed-shed-heading">
          <div className="content-width">
            <div className="section-heading">
              <h2 id="seed-shed-heading"><span>From the</span> Seed Shed</h2>
              <Link href="/resources" className="button button-outline" data-testid="button-view-articles">View all articles</Link>
            </div>
            <div className="article-grid">
              {seedShedArticles.map((article) => (
                <article className="article-card" key={article.id} data-testid={`card-home-article-${article.slug}`}>
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
          </div>
        </section>
      )}

      <section id="guide" className="section guide-section">
        <div className="guide-banner" style={{ backgroundImage: `linear-gradient(90deg, rgba(29,40,28,.92), rgba(29,40,28,.44)), url(${guideImage})` }}>
          <div>
            <h2>{settings.seedGuide.cardHeading}</h2>
            <a href={settings.seedGuide.pdfPublicUrl} className="button button-light" style={{ display: "inline-block", textDecoration: "none" }} data-testid="button-download-guide" download>{settings.seedGuide.cardButtonLabel}</a>
          </div>
        </div>
      </section>
    </>
  );
}
