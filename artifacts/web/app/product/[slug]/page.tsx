import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Icon } from "../../../components/Icon";
import { StatusPill } from "../../../components/StatusPill";
import { defaultSaleLine, getCategories, getProductBySlug, getProducts, getRedirect, saleLinePackLabels, type CatalogueCategory, type CatalogueProduct } from "../../../lib/catalogue";
import { getProductQuickFacts } from "../../../lib/product-quick-facts";
import { absoluteSiteUrl } from "../../../lib/site-url";
import { productCanonicalUrl, techSheetHref } from "../../../lib/product-url";
import { forSearchMetadata } from "../../../lib/search-metadata";

type Props = { params: Promise<{ slug: string }> };
const fallbackImage = "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80";

async function productForRoute(slug: string) {
  const product = await getProductBySlug(slug);
  if (product) return product;
  const redirect = await getRedirect(`/product/${slug}`);
  if (redirect) permanentRedirect(redirect);
  notFound();
}

function categoryPath(product: CatalogueProduct, categories: CatalogueCategory[]) {
  const category = categories.find((candidate) => candidate.parentId === null && candidate.name === product.category);
  return category ? `/products/${category.slug}` : "/products";
}

function productImage(product: CatalogueProduct) {
  return product.details.photos?.find((photo) => photo.src?.trim())?.src || fallbackImage;
}

function offerAvailability(status: string) {
  return status === "unavailable" ? "https://schema.org/OutOfStock" : "https://schema.org/InStock";
}

function priceValue(value: string) {
  const matched = value.replace(/,/g, "").match(/\d+(?:\.\d{1,2})?/);
  return matched?.[0];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await productForRoute(slug);
  const details = product.details;
  const title = forSearchMetadata(details.seoTitle?.trim() || `${product.name} | IH Seeds`);
  const description = forSearchMetadata(details.seoDescription?.trim() || details.blurb?.trim() || product.note);
  const image = details.socialImage?.trim() || productImage(product);
  const canonical = productCanonicalUrl(details.canonicalUrl, `/product/${product.slug}`);
  return {
    title,
    description,
    alternates: { canonical },
    robots: details.robotsIndex === false ? { index: false, follow: false } : undefined,
    openGraph: { type: "website", url: canonical, title: forSearchMetadata(details.socialTitle?.trim() || title), description: forSearchMetadata(details.socialDescription?.trim() || description), images: [{ url: image, alt: product.name }] },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await productForRoute(slug);
  const [allProducts, categories, quickFacts] = await Promise.all([
    getProducts(),
    getCategories(),
    Promise.resolve(getProductQuickFacts(product)),
  ]);
  const details = product.details;
  const image = productImage(product);
  const canonical = productCanonicalUrl(details.canonicalUrl, `/product/${product.slug}`);
  const techSheet = techSheetHref(product.techSheet);
  const categoryUrl = categoryPath(product, categories);
  const related = (details.relatedProducts ?? [])
    .map((relatedSlug) => allProducts.find((candidate) => candidate.slug === relatedSlug))
    .filter((candidate): candidate is CatalogueProduct => Boolean(candidate));
  const defaultLine = defaultSaleLine(product);
  const listedPrice = defaultLine?.priceDisplay?.trim() || "";
  const packLabels = saleLinePackLabels(product);
  const hasComponentRates = (details.components ?? []).some((component) => component.inclusionRate != null);
  const alsoPopular = allProducts
    .filter((candidate) => candidate.id !== product.id && candidate.category === product.category)
    .sort((first, second) => Number(second.details.featured) - Number(first.details.featured) || first.name.localeCompare(second.name))
    .slice(0, 3);
  const price = listedPrice ? priceValue(listedPrice) : undefined;
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: defaultLine?.stockCode || product.slug,
    brand: { "@type": "Brand", name: "IH Seeds" },
    description: forSearchMetadata(details.seoDescription || details.blurb || product.note),
    image,
    url: absoluteSiteUrl(canonical),
    offers: {
      "@type": "Offer",
      url: absoluteSiteUrl(canonical),
      availability: offerAvailability(product.status),
      ...(price ? { price, priceCurrency: "AUD" } : {}),
    },
    additionalProperty: quickFacts.map((fact) => ({ "@type": "PropertyValue", name: fact.label, value: String(fact.value) })),
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Products", item: absoluteSiteUrl("/products") },
      { "@type": "ListItem", position: 2, name: product.category, item: absoluteSiteUrl(categoryUrl) },
      { "@type": "ListItem", position: 3, name: product.name, item: absoluteSiteUrl(canonical) },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([productJsonLd, breadcrumbJsonLd]).replace(/</g, "\\u003c") }} />
      <section style={{ minHeight: 520, backgroundImage: `linear-gradient(rgba(29,40,28,.55), rgba(29,40,28,.72)), url(${image})`, backgroundSize: "cover", backgroundPosition: "center" }}>
        <div className="product-hero-content" style={{ maxWidth: 1180, margin: "0 auto", padding: "150px 40px 64px", display: "flex", flexDirection: "column", gap: 20 }}>
          <nav aria-label="Breadcrumb" style={{ color: "var(--yellow)", fontSize: 14, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase" }}>
            <Link href="/products">Products</Link> › <Link href={categoryUrl}>{product.category}</Link>
          </nav>
          <h1 style={{ color: "#fff", fontSize: "clamp(44px,6vw,64px)", lineHeight: 1.05, fontWeight: 700, maxWidth: "20ch" }}>{product.name}</h1>
          {details.tagline && <p className="product-hero-tagline">{details.tagline}</p>}
          {details.botanicalName && <p style={{ color: "#C5CCC5", fontSize: 20, fontStyle: "italic" }}>{details.botanicalName}</p>}
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}><StatusPill status={product.status} />{techSheet && <a className="button button-primary" href={techSheet} target="_blank" rel="noreferrer">Download tech sheet</a>}</div>
        </div>
      </section>
      <section>
        <div className="product-detail-grid">
          <article className="product-main-col">
            {details.blurb && <p className="product-blurb mobile-order-1">{details.blurb}</p>}
            {(details.keyAttributes ?? []).filter(Boolean).length > 0 && <section className="product-key-attributes mobile-order-3"><h2>Key attributes</h2><ul>{details.keyAttributes!.filter(Boolean).map((attribute, index) => <li key={`${attribute}-${index}`}>{attribute}</li>)}</ul></section>}
            <div className="product-main-rest mobile-order-4">
            {details.distributionNote && <aside className="product-distribution-note"><Icon name="info" size={22} /><p>{details.distributionNote}</p></aside>}
            {details.recordType === "Mix" && <section style={{ display: "grid", gap: 16 }}><h2 style={{ color: "var(--green)", fontSize: 28 }}>Mix components</h2>{details.formulationYear && <p style={{ color: "var(--muted)" }}>Formulation {details.formulationYear}</p>}<div className="product-table-wrap" style={{ border: "1px solid var(--line)", borderRadius: 16 }}><table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}><thead><tr style={{ background: "var(--sage)", color: "var(--green)", fontSize: 14 }}><th style={{ padding: "12px 16px", borderBottom: "2px solid #C5CCC5" }}>Component</th>{hasComponentRates && <th style={{ padding: "12px 16px", borderBottom: "2px solid #C5CCC5" }}>Rate</th>}</tr></thead><tbody>{(details.components ?? []).map((component, index) => { const componentProduct = allProducts.find((candidate) => candidate.slug === component.productLink); const componentDescription = component.description?.trim(); return <tr key={`${component.speciesName}-${index}`} style={{ borderBottom: "1px solid var(--line)" }}><td className="mix-component-cell"><div className="mix-component-name">{componentProduct ? <Link href={`/product/${componentProduct.slug}`}>{component.speciesName}</Link> : component.speciesName}</div>{componentDescription && <div className="mix-component-description">{componentDescription}</div>}</td>{hasComponentRates && <td style={{ padding: "12px 16px" }}>{component.inclusionRate != null ? `${component.inclusionRate}${component.unit ? `${component.unit === "%" ? "" : " "}${component.unit}` : ""}` : "—"}</td>}</tr>; })}</tbody></table></div></section>}
            {details.description && <section style={{ display: "grid", gap: 16 }}><h2 style={{ color: "var(--green)", fontSize: 30 }}>About this variety</h2>{details.description.split(/\n\s*\n/).filter((paragraph) => paragraph.trim()).map((paragraph, index) => <p key={index} style={{ fontSize: 17, lineHeight: 1.7, maxWidth: "64ch" }}>{paragraph.trim()}</p>)}</section>}
            {(details.grazingManagementNotes || details.diseasePestResistance || details.standLifeNotes) && <section style={{ display: "grid", gap: 16 }} aria-label="Product growing notes">{details.grazingManagementNotes && <details style={{ borderBottom: "1px solid var(--line)", paddingBottom: 16 }}><summary style={{ color: "var(--green)", cursor: "pointer", fontSize: 20, fontWeight: 700 }}>Planting &amp; grazing notes</summary><p style={{ margin: "16px 0 0", lineHeight: 1.6 }}>{details.grazingManagementNotes}</p></details>}{details.diseasePestResistance && <details style={{ borderBottom: "1px solid var(--line)", paddingBottom: 16 }}><summary style={{ color: "var(--green)", cursor: "pointer", fontSize: 20, fontWeight: 700 }}>Disease &amp; pest resistance</summary><p style={{ margin: "16px 0 0", lineHeight: 1.6 }}>{details.diseasePestResistance}</p></details>}{details.standLifeNotes && <details style={{ borderBottom: "1px solid var(--line)", paddingBottom: 16 }}><summary style={{ color: "var(--green)", cursor: "pointer", fontSize: 20, fontWeight: 700 }}>Stand life</summary><p style={{ margin: "16px 0 0", lineHeight: 1.6 }}>{details.standLifeNotes}</p></details>}</section>}
            <section style={{ display: "grid", gap: 16 }}><h2 style={{ color: "var(--green)", fontSize: 28 }}>How it&apos;s sold</h2><div className="product-table-wrap sold-table"><table><thead><tr><th>Form</th><th>Pack</th><th>Status</th></tr></thead><tbody>{product.saleLines?.map((line) => <tr key={line.stockCode}><td>{line.seedForm || "Bare"}</td><td>{line.packKg ? `${line.packKg} ${line.packUnit}` : product.packSize}</td><td className="sold-status"><StatusPill status={({ "Good stock": "in-stock", "Low stock": "low", "Very low": "very-low", Unavailable: "unavailable" }[line.availability ?? "Unavailable"] ?? product.status)} /></td></tr>)}</tbody></table></div></section>
            </div>
          </article>
          <aside className="product-sidebar-col">
            <div className="product-sidebar-card mobile-order-2">
              {quickFacts.length > 0 && <section className="quick-facts-section"><h2 className="sidebar-card-heading">Quick facts</h2><div className="quick-facts-list">{quickFacts.map((fact) => <div className="quick-fact-item" key={fact.label}><span className="quick-fact-icon"><Icon name={fact.icon} size={22} /></span><div className="quick-fact-content"><span className="quick-fact-label">{fact.label}</span><span className="quick-fact-value">{fact.value}</span></div></div>)}</div></section>}
              <div className="pricing-section"><StatusPill status={product.status} /><div className="pricing-details"><strong className="pricing-amount">{listedPrice || "Contact for pricing"}</strong>{packLabels.length > 0 && <span className="pricing-unit">Available in {packLabels.join(", ")}</span>}</div><Link href="/contact" className="button button-primary" style={{ width: "100%", textAlign: "center" }}>Ask about an order</Link><small className="pricing-disclaimer">We supply through rural resellers across Western Australia.</small></div>
            </div>
            <div className="product-sidebar-bottom mobile-order-5">
              {related.length > 0 && <section><h2 className="sidebar-bottom-heading">Related products</h2><div className="related-products-list">{related.map((item) => <Link className="related-product-card" key={item.id} href={`/product/${item.slug}`}><div className="related-product-image" style={{ backgroundImage: `url(${productImage(item)})` }} /><div className="related-product-info"><strong className="related-product-name">{item.name}</strong><span className="related-product-tagline">{item.details.tagline}</span></div></Link>)}</div></section>}
              {(details.certification?.length || details.pbrProtected) && <div className="product-meta-section">{details.certification?.length ? <div>Certification: {details.certification.join(", ")}</div> : null}{details.pbrProtected ? <div>PBR: {details.pbrDetails || "Protected"}</div> : null}</div>}
            </div>
          </aside>
        </div>
      </section>
      {alsoPopular.length > 0 && <section className="also-popular-section" aria-labelledby="also-popular-heading"><div className="also-popular-inner"><div className="also-popular-header"><h2 id="also-popular-heading">Also popular:</h2><Link href={categoryUrl} className="also-popular-category-link">View all {product.category}<Icon name="arrow-right" size={18} /></Link></div><div className="also-popular-grid">{alsoPopular.map((item) => <Link key={item.id} href={`/product/${item.slug}`} className="also-popular-card"><div className="also-popular-image" role="img" aria-label={item.name} style={{ backgroundImage: `url(${productImage(item)})` }}><StatusPill status={item.status} /></div><div className="also-popular-card-body"><div><h3>{item.name}</h3>{item.details.tagline?.trim() && <p>{item.details.tagline}</p>}</div><span className="also-popular-arrow" aria-hidden="true"><Icon name="arrow-right" size={18} /></span></div></Link>)}</div></div></section>}
    </>
  );
}