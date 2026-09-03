import React from "react";
import { Link } from "../router";
import { useProducts, imageOptions, productPath } from "../hooks/useApi";
import { StatusPill, Icon } from "../components/ui";

export default function Home() {
  const { products, loading } = useProducts();
  const visibleProducts = products.slice(0, 4);

  return (
    <>
      <section className="hero-wrap">
        <div className="hero" style={{ backgroundImage: `linear-gradient(90deg, rgba(29,40,28,.98) 0%, rgba(29,40,28,.84) 47%, rgba(29,40,28,.42) 100%), url(${imageOptions[0]})` }}>
          <div className="hero-copy">
            <h1><span>Western Australia's</span><strong>Pasture Seed Specialists</strong></h1>
            <p>Independently owned since 1966. We source, test and blend improved pasture seed for every region of the state — from Esperance to Derby.</p>
            <div className="hero-actions">
              <Link href="/contact" className="button button-primary" data-testid="button-advice">Advice</Link>
              <Link href="/products" className="button button-light" data-testid="button-browse-catalogue">Browse the catalogue</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="pillars" aria-label="Why IH Seeds">
        <div className="three-column">
          <div className="pillar"><Icon name="map-pin" size={27} /><h3>Regional expertise</h3><p>Local conditions, understood and applied. Sixty years of sowing across every WA rainfall zone.</p></div>
          <div className="pillar"><Icon name="sprout" size={27} /><h3>Proven performance</h3><p>Varieties and mixes proven over generations across Australia, with trial data behind them.</p></div>
          <div className="pillar"><Icon name="handshake" size={27} /><h3>Partnership</h3><p>Confidence before the order. Support after it — through your local rural reseller.</p></div>
        </div>
      </section>

      <section id="products" className="section section-subtle">
        <div className="content-width">
          <div className="section-heading">
            <h2><span>Best</span> Sellers</h2>
            <Link href="/products" className="button button-outline" data-testid="button-view-all">View all products</Link>
          </div>
          {loading ? (
            <div className="loading-state" data-testid="status-products-loading">Loading the catalogue…</div>
          ) : visibleProducts.length === 0 ? (
            <div className="empty-state" data-testid="status-products-empty">No products match.</div>
          ) : (
            <div className="product-grid">
              {visibleProducts.map((product, index) => (
                <Link href={productPath(product)} className="product-card" style={{ textDecoration: "none", color: "inherit" }} key={product.id} data-testid={`card-product-${product.id}`}>
                  <div className="product-image" style={{ backgroundImage: `linear-gradient(180deg, transparent, rgba(29,40,28,.72)), url(${imageOptions[index % imageOptions.length]})` }}>
                    <StatusPill status={product.status} />
                  </div>
                  <div className="product-details">
                    <h3>{product.name}</h3>
                    <p>{product.packSize}</p>
                    <strong>{product.price}</strong>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section id="about" className="section about-section">
        <div className="feature-panel">
          <div className="feature-image" style={{ backgroundImage: `linear-gradient(90deg, rgba(12,88,60,.12), rgba(12,88,60,.02)), url(${imageOptions[2]})` }} />
          <div className="feature-copy">
            <h2><span>About</span> Us</h2>
            <p>Irwin Hunter &amp; Co has been Western Australian owned and operated since 1966. We supply true to type seed from credible growers, blended into mixes that suit the paddock they are going into. Our long history across the state means we know which varieties perform in every region.</p>
            <Link href="/about" className="button button-outline" style={{ color: "#fff", borderColor: "#fff" }} data-testid="button-learn-about">Learn more about IH Seeds</Link>
          </div>
        </div>
      </section>

      <section id="guide" className="section guide-section">
        <div className="guide-banner" style={{ backgroundImage: `linear-gradient(90deg, rgba(29,40,28,.92), rgba(29,40,28,.44)), url(${imageOptions[1]})` }}>
          <div>
            <h2>Regional advice, sowing rates and seasonal planning in one place.</h2>
            <a href="/IH-Seeds-2026-Pasture-Seed-Guide.pdf" className="button button-light" style={{ display: "inline-block", textDecoration: "none" }} data-testid="button-download-guide" download>Download the 2026 Pasture Seed Guide (PDF)</a>
          </div>
        </div>
      </section>
    </>
  );
}
