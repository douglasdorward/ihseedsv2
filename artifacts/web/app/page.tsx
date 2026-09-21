import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "../components/Icon";
import { ProductNewStamp } from "../components/NewStamp";
import { StatusPill } from "../components/StatusPill";
import { getCategories, getProducts } from "../lib/catalogue";
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

export default async function Home() {
  const [products, categories, settings] = await Promise.all([getProducts(), getCategories(), loadSiteSettings()]);
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
