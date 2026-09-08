import type { Metadata } from "next";
import Link from "next/link";
import { getCategories, getProducts } from "../../lib/catalogue";
import { ProductsCatalogue } from "./ProductsCatalogue";

export const metadata: Metadata = {
  title: "Pasture Seed Products | IH Seeds",
  description: "Browse pasture seed varieties and mixes selected for Western Australian rainfall zones, soils and grazing systems.",
};

export default async function Products() {
  const [categories, products] = await Promise.all([getCategories(), getProducts()]);

  return (
    <>
      <section style={{ background: "var(--sage)" }}>
        <div className="page-hero-grid" style={{ maxWidth: 1180, margin: "0 auto", padding: "80px 40px", display: "grid", gridTemplateColumns: "minmax(0, 1.15fr) minmax(0, 1fr)", gap: 64, alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--green)" }}>Products</div>
            <h1 style={{ margin: 0, fontSize: 48, lineHeight: 1.2, fontWeight: 300, color: "var(--green)", maxWidth: "16ch" }}>Find the seed that fits your <span style={{ fontWeight: 700 }}>paddock</span></h1>
            <p style={{ margin: 0, fontSize: 18, lineHeight: 1.6, color: "var(--black-green)", maxWidth: "52ch" }}>Browse the current online range by pasture category, sourced and tested for Western Australian conditions, then order through your local rural reseller.</p>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", paddingTop: 8 }}>
              <Link href="/contact" className="button button-primary">Get in Touch</Link>
              <Link href="/contact" className="button button-outline">Find a reseller</Link>
            </div>
          </div>
          <div style={{ borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 10px rgba(29,40,28,0.10)" }}>
            <img className="products-hero-image" src="https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=900&q=80" alt="Seed in a weathered hand" style={{ display: "block", width: "100%", height: 380, objectFit: "cover" }} />
          </div>
        </div>
      </section>

      <section style={{ background: "#FFFFFF" }}>
        <div className="page-content" style={{ maxWidth: 1180, margin: "0 auto", padding: "96px 40px 64px" }}>
          <ProductsCatalogue categories={categories} products={products} />
        </div>
      </section>

      <section style={{ background: "#FFFFFF" }}>
        <div className="page-wide" style={{ maxWidth: 1440, margin: "0 auto", padding: "32px 40px 96px" }}>
          <div className="feature-panel" style={{ minHeight: 480 }}>
            <div className="feature-copy">
              <h2 style={{ fontSize: 48 }}>Tested before it <br className="feature-heading-break"/><strong>ships</strong></h2>
              <p>Every line is true to type seed from credible growers, germination tested and blended to order. If you are unsure which species suits your rainfall zone, soil type and grazing plan, talk to us before you order — that advice is part of the seed.</p>
              <Link href="/resources" className="button button-outline" style={{ color: "#fff", borderColor: "#fff" }}>Download the Tech Sheet</Link>
            </div>
            <div className="feature-image" style={{ backgroundImage: `url(https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=900&q=80)`, backgroundPosition: "right" }} />
          </div>
        </div>
      </section>
    </>
  );
}