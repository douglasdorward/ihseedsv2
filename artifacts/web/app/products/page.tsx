import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CoverImage } from "../../components/CoverImage";
import { categoryPageHeading, getCategories, getProducts } from "../../lib/catalogue";
import { CATALOGUE_INDEX_PATH } from "../../lib/catalogue-paths";
import { ProductsListing } from "./ProductsListing";
import { toListingProduct } from "../../lib/product-listing";
import { siteSocialMetadata } from "../../lib/social-metadata";
import { absoluteSiteUrl } from "../../lib/site-url";

const metadata: Metadata = {
  title: "Pasture Seed Products | IH Seeds",
  description: "Browse pasture seed varieties and mixes selected for Western Australian rainfall zones, soils and grazing systems.",
  alternates: { canonical: CATALOGUE_INDEX_PATH },
};

export async function generateMetadata(): Promise<Metadata> {
  return { ...metadata, ...await siteSocialMetadata(metadata.title as string, metadata.description as string, CATALOGUE_INDEX_PATH) };
}

export default async function ProductsIndex() {
  const [categories, products] = await Promise.all([getCategories(), getProducts()]);
  const roots = categories
    .filter((category) => category.parentId === null && category.active && (category.productCount ?? 0) > 0)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: absoluteSiteUrl("/") },
        { "@type": "ListItem", position: 2, name: "Products", item: absoluteSiteUrl(CATALOGUE_INDEX_PATH) },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "IH Seeds pasture seed categories",
      itemListElement: roots.map((category, index) => {
        const image = category.image?.trim();
        const description = category.lead?.trim();
        return {
          "@type": "ListItem",
          position: index + 1,
          name: categoryPageHeading(category),
          url: absoluteSiteUrl(`/products/${category.slug}`),
          ...(image ? { image: absoluteSiteUrl(image) } : {}),
          ...(description ? { description } : {}),
        };
      }),
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <section style={{ background: "var(--sage)" }}>
        <div className="category-intro products-intro" style={{ maxWidth: 1180, margin: "0 auto", padding: "56px 40px 48px", display: "flex", flexDirection: "column", gap: 20 }}>
          <h1 style={{ margin: 0, fontSize: 48, lineHeight: 1.2, fontWeight: 300, color: "var(--green)" }}>Find the seed that fits your <span>paddock</span></h1>
          <p style={{ margin: 0, fontSize: 18, lineHeight: 1.6, color: "var(--black-green)", maxWidth: "64ch" }}>Browse the current online range by pasture category, sourced and tested for Western Australian conditions, then order through your local rural reseller.</p>
          <p className="pasture-selector-banner">Not sure where to start? <Link href="/pasture-selector">Try the Pasture Selector</Link> or <Link href="/contact">Contact Us</Link></p>
        </div>
      </section>

      <section style={{ background: "#FFFFFF" }}>
        <div className="page-content products-page-content" style={{ maxWidth: 1180, margin: "0 auto", padding: "36px 40px 64px" }}>
          <Suspense fallback={<div className="empty-state">Loading products…</div>}>
            <ProductsListing categories={categories} products={products.map(toListingProduct)} />
          </Suspense>
        </div>
      </section>

      <section style={{ background: "#FFFFFF" }}>
        <div className="page-wide" style={{ maxWidth: 1440, margin: "0 auto", padding: "32px 40px 96px" }}>
          <div className="feature-panel" style={{ minHeight: 480 }}>
            <div className="feature-copy">
              <h2 style={{ fontSize: 48 }}>Tested before it <br className="feature-heading-break"/><strong>ships</strong></h2>
              <p>Every line is true to type seed from credible growers, germination tested and blended to order. If you are unsure which species suits your rainfall zone, soil type and grazing plan, talk to us before you order — that advice is part of the seed.</p>
              <Link href="/tech-sheets" className="button button-outline" style={{ color: "#fff", borderColor: "#fff" }}>Download the Tech Sheet</Link>
            </div>
            <div className="feature-image">
              <CoverImage src="https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=900&q=80" alt="" sizes="(max-width: 900px) 100vw, 680px" className="cover-image cover-image-right" />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
