import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getCategories, getProducts } from "../../lib/catalogue";
import { CATALOGUE_INDEX_PATH } from "../../lib/catalogue-paths";
import { ProductsListing } from "./ProductsListing";

export const metadata: Metadata = {
  title: "Pasture Seed Products | IH Seeds",
  description: "Browse pasture seed varieties and mixes selected for Western Australian rainfall zones, soils and grazing systems.",
  alternates: { canonical: CATALOGUE_INDEX_PATH },
};

export default async function ProductsIndex() {
  const [categories, products] = await Promise.all([getCategories(), getProducts()]);

  return (
    <>
      <section style={{ background: "var(--sage)" }}>
        <div className="category-intro products-intro" style={{ maxWidth: 1180, margin: "0 auto", padding: "56px 40px 48px", display: "flex", flexDirection: "column", gap: 20 }}>
          <h1 style={{ margin: 0, fontSize: 48, lineHeight: 1.2, fontWeight: 300, color: "var(--green)" }}>Find the seed that fits your <span>paddock</span></h1>
          <p style={{ margin: 0, fontSize: 18, lineHeight: 1.6, color: "var(--black-green)", maxWidth: "64ch" }}>Browse the current online range by pasture category, sourced and tested for Western Australian conditions, then order through your local rural reseller.</p>
        </div>
      </section>

      <section style={{ background: "#FFFFFF" }}>
        <div className="page-content" style={{ maxWidth: 1180, margin: "0 auto", padding: "48px 40px 64px" }}>
          <Suspense fallback={<div className="empty-state">Loading products…</div>}>
            <ProductsListing categories={categories} products={products} />
          </Suspense>
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
