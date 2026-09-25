import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Icon } from "../../components/Icon";
import { ProductNewStamp } from "../../components/NewStamp";
import { StatusPill } from "../../components/StatusPill";
import {
  defaultSaleLine,
  getCategories,
  getProductBySlug,
  getProducts,
  getRedirect,
  getResellers,
  productPageHeading,
  saleLinePackLabels,
  type CatalogueCategory,
  type CatalogueProduct,
} from "../../lib/catalogue";
import { CATALOGUE_INDEX_PATH, categoryPublicPath, productPublicPath, rootCategoryForProduct } from "../../lib/catalogue-paths";
import { resolveAlsoPopular } from "../../lib/also-popular";
import { getProductQuickFacts } from "../../lib/product-quick-facts";
import { productCanonicalUrl } from "../../lib/product-url";
import { forSearchMetadata } from "../../lib/search-metadata";
import { companyTelHref } from "../../lib/company";
import { loadSiteSettings } from "../../lib/site-settings";
import { absoluteSiteUrl } from "../../lib/site-url";
import { hasProductPhoto, PRODUCT_FALLBACK_IMAGE, productImageAlt } from "./product-card-facts";

const PUBLISHED_OFFICE_PHONE = "(08) 9383 4708";

function resellerShopRound(count: number) {
  return Math.floor(count / 5) * 5;
}

type RouteParams = { category: string; product: string };

function attachedPhotos(product: CatalogueProduct) {
  return (product.details.photos ?? []).flatMap((photo) => {
    const src = photo.src?.trim();
    return src ? [{ ...photo, src }] : [];
  });
}

function productImage(product: CatalogueProduct) {
  return attachedPhotos(product)[0]?.src || PRODUCT_FALLBACK_IMAGE;
}

function photoAltText(productName: string, photo: { alt?: string }) {
  return photo.alt?.trim() || productName;
}

function photoDimension(value: number | undefined) {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 ? value : undefined;
}

function offerAvailability(status: string) {
  return status === "unavailable" ? "https://schema.org/OutOfStock" : "https://schema.org/InStock";
}

function priceValue(value: string) {
  const matched = value.replace(/,/g, "").match(/\d+(?:\.\d{1,2})?/);
  return matched?.[0];
}

function completeProductFaqs(faqs: CatalogueProduct["details"]["faqs"]) {
  return (faqs ?? [])
    .map((faq) => ({ question: faq.question?.trim() ?? "", answer: faq.answer?.trim() ?? "" }))
    .filter((faq) => faq.question && faq.answer)
    .slice(0, 10);
}

function childCategoryPath(categories: CatalogueCategory[], categorySlug: string, childSlug: string) {
  const root = categories.find((category) => category.parentId === null && category.slug === categorySlug);
  if (!root) return null;
  return categories.some((category) => category.parentId === root.id && category.slug === childSlug)
    ? categoryPublicPath(root)
    : null;
}

async function productForNestedRoute(params: RouteParams) {
  const categories = await getCategories();
  const product = await getProductBySlug(params.product);
  if (product) {
    const canonical = productPublicPath(product, categories);
    const expected = `/products/${params.category}/${params.product}`;
    if (canonical !== expected) permanentRedirect(canonical);
    return { product, categories, canonical };
  }

  const childPath = childCategoryPath(categories, params.category, params.product);
  if (childPath) permanentRedirect(childPath);

  const nestedRedirect = await getRedirect(`/products/${params.category}/${params.product}`);
  if (nestedRedirect) permanentRedirect(nestedRedirect);
  const legacyRedirect = await getRedirect(`/product/${params.product}`);
  if (legacyRedirect) permanentRedirect(legacyRedirect);
  notFound();
}

export async function productMetadata(params: RouteParams): Promise<Metadata> {
  const { product, canonical } = await productForNestedRoute(params);
  const details = product.details;
  const title = forSearchMetadata(details.seoTitle?.trim() || `${product.name} | IH Seeds`);
  const description = forSearchMetadata(details.seoDescription?.trim() || details.blurb?.trim() || product.note);
  const image = details.socialImage?.trim() || productImage(product);
  const canonicalHref = productCanonicalUrl(details.canonicalUrl, canonical);
  return {
    title,
    description,
    alternates: { canonical: canonicalHref },
    robots: details.robotsIndex === false ? { index: false, follow: false } : undefined,
    openGraph: {
      type: "website",
      url: canonicalHref,
      title: forSearchMetadata(details.socialTitle?.trim() || title),
      description: forSearchMetadata(details.socialDescription?.trim() || description),
      images: [{ url: image, alt: productImageAlt(product) }],
    },
  };
}

export async function NestedProductPage({ params }: { params: RouteParams }) {
  const { product, categories, canonical } = await productForNestedRoute(params);
  const [allProducts, quickFacts, settings, resellers] = await Promise.all([
    getProducts(),
    Promise.resolve(getProductQuickFacts(product)),
    loadSiteSettings(),
    getResellers().catch(() => []),
  ]);
  const resellerShops = resellerShopRound(
    resellers.reduce((total, brand) => total + brand.outlets.length, 0),
  );
  const configuredPhone = settings.company.phone.trim();
  const officePhone = configuredPhone && companyTelHref(configuredPhone) ? configuredPhone : PUBLISHED_OFFICE_PHONE;
  const officeTel = companyTelHref(officePhone);
  const details = product.details;
  const image = productImage(product);
  const heroOverlay = hasProductPhoto(product)
    ? "linear-gradient(rgba(29,40,28,.55), rgba(29,40,28,.72))"
    : "linear-gradient(rgba(39,45,42,.38), rgba(39,45,42,.56))";
  const canonicalHref = productCanonicalUrl(details.canonicalUrl, canonical);
  const root = rootCategoryForProduct(product, categories);
  const categoryUrl = root ? categoryPublicPath(root) : CATALOGUE_INDEX_PATH;
  const defaultLine = defaultSaleLine(product);
  const listedPrice = defaultLine?.priceDisplay?.trim() || "";
  const packLabels = saleLinePackLabels(product);
  const hasComponentRates = (details.components ?? []).some((component) => component.inclusionRate != null);
  const alsoPopular = resolveAlsoPopular(product, details.relatedProducts, allProducts);
  const faqs = completeProductFaqs(details.faqs);
  const price = listedPrice ? priceValue(listedPrice) : undefined;
  const photos = attachedPhotos(product);
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: defaultLine?.stockCode || product.slug,
    brand: { "@type": "Brand", name: "IH Seeds" },
    description: forSearchMetadata(details.seoDescription || details.blurb || product.note),
    image: photos.length > 0 ? photos.map((photo) => absoluteSiteUrl(photo.src)) : image,
    url: absoluteSiteUrl(canonicalHref),
    offers: {
      "@type": "Offer",
      url: absoluteSiteUrl(canonicalHref),
      availability: offerAvailability(product.status),
      ...(price ? { price, priceCurrency: "AUD" } : {}),
    },
    additionalProperty: quickFacts.map((fact) => ({ "@type": "PropertyValue", name: fact.label, value: String(fact.value) })),
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Products", item: absoluteSiteUrl(CATALOGUE_INDEX_PATH) },
      { "@type": "ListItem", position: 2, name: product.category, item: absoluteSiteUrl(categoryUrl) },
      { "@type": "ListItem", position: 3, name: product.name, item: absoluteSiteUrl(canonicalHref) },
    ],
  };
  const faqJsonLd = faqs.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  } : null;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([productJsonLd, breadcrumbJsonLd, ...(faqJsonLd ? [faqJsonLd] : [])]).replace(/</g, "\\u003c") }} />
      <section className="product-hero" style={{ minHeight: 520, backgroundImage: `${heroOverlay}, url(${image})`, backgroundSize: "cover", backgroundPosition: "center" }}>
        {!hasProductPhoto(product) && <img className="product-hero-fallback-logo" src="/ih-seeds-logo.png" alt="" />}
        <ProductNewStamp listingState={product.listingState} size="hero" />
        <div className="product-hero-content" style={{ maxWidth: 1180, margin: "0 auto", padding: "150px 40px 64px", display: "flex", flexDirection: "column", gap: 20 }}>
          <nav aria-label="Breadcrumb" style={{ color: "var(--yellow)", fontSize: 14, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase" }}>
            <Link href={CATALOGUE_INDEX_PATH}>Products</Link> › <Link href={categoryUrl}>{product.category}</Link>
          </nav>
          <h1 style={{ color: "#fff", fontSize: "clamp(44px,6vw,64px)", lineHeight: 1.05, fontWeight: 700, maxWidth: "20ch" }}>{productPageHeading(product)}</h1>
          {details.tagline && <p className="product-hero-tagline">{details.tagline}</p>}
          {details.botanicalName && <p style={{ color: "#C5CCC5", fontSize: 20, fontStyle: "italic" }}>{details.botanicalName}</p>}
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}><StatusPill status={product.status} /><a className="button button-primary" href={`/tech-sheets/${product.slug}`} target="_blank" rel="noreferrer">Download tech sheet</a></div>
        </div>
      </section>
      <section>
        <div className="product-detail-grid">
          <article className="product-main-col">
            {details.blurb && <p className="product-blurb mobile-order-1">{details.blurb}</p>}
            {(details.keyAttributes ?? []).filter(Boolean).length > 0 && <section className="product-key-attributes mobile-order-3"><h2>Key attributes</h2><ul>{details.keyAttributes!.filter(Boolean).map((attribute, index) => <li key={`${attribute}-${index}`}>{attribute}</li>)}</ul></section>}
            {(details.distributionNote || details.recordType === "Mix" || details.description) && <div className="product-main-rest mobile-order-4">
            {details.distributionNote && <aside className="product-distribution-note"><Icon name="info" size={22} /><p>{details.distributionNote}</p></aside>}
            {details.recordType === "Mix" && <section style={{ display: "grid", gap: 16 }}><h2 style={{ color: "var(--green)", fontSize: 28 }}>Mix components</h2>{details.formulationYear && <p style={{ color: "var(--muted)" }}>Formulation {details.formulationYear}</p>}<div className="product-table-wrap" style={{ border: "1px solid var(--line)", borderRadius: 16 }}><table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}><thead><tr style={{ background: "var(--sage)", color: "var(--green)", fontSize: 14 }}><th style={{ padding: "12px 16px", borderBottom: "2px solid #C5CCC5" }}>Component</th>{hasComponentRates && <th style={{ padding: "12px 16px", borderBottom: "2px solid #C5CCC5" }}>Rate</th>}</tr></thead><tbody>{(details.components ?? []).map((component, index) => { const componentProduct = allProducts.find((candidate) => candidate.slug === component.productLink); const componentDescription = component.description?.trim(); return <tr key={`${component.speciesName}-${index}`} style={{ borderBottom: "1px solid var(--line)" }}><td className="mix-component-cell"><div className="mix-component-name">{componentProduct ? <Link href={productPublicPath(componentProduct, categories)}>{component.speciesName}</Link> : component.speciesName}</div>{componentDescription && <div className="mix-component-description">{componentDescription}</div>}</td>{hasComponentRates && <td style={{ padding: "12px 16px" }}>{component.inclusionRate != null ? `${component.inclusionRate}${component.unit ? `${component.unit === "%" ? "" : " "}${component.unit}` : ""}` : "—"}</td>}</tr>; })}</tbody></table></div><p className="mix-disclaimer" style={{ color: "var(--muted)", fontStyle: "italic", fontSize: 14, lineHeight: 1.6, margin: 0 }}>*Occasionally some varieties in our mix will be replaced with a like-for-like variety where the original is not available or not easily accessible. Varieties in the mix will be specified on the bag label.</p></section>}
            {details.description && <section style={{ display: "grid", gap: 16 }}><h2 style={{ color: "var(--green)", fontSize: 30 }}>About this variety</h2>{details.description.split(/\n\s*\n/).filter((paragraph) => paragraph.trim()).map((paragraph, index) => <p key={index} style={{ fontSize: 17, lineHeight: 1.7, maxWidth: "64ch" }}>{paragraph.trim()}</p>)}</section>}
            </div>}
            <div className="product-main-rest mobile-order-6">
            {(details.grazingManagementNotes || details.diseasePestResistance || details.standLifeNotes) && <section style={{ display: "grid", gap: 16 }} aria-label="Product growing notes">{details.grazingManagementNotes && <details style={{ borderBottom: "1px solid var(--line)", paddingBottom: 16 }}><summary style={{ color: "var(--green)", cursor: "pointer", fontSize: 20, fontWeight: 700 }}>Planting &amp; grazing notes</summary><p style={{ margin: "16px 0 0", lineHeight: 1.6 }}>{details.grazingManagementNotes}</p></details>}{details.diseasePestResistance && <details style={{ borderBottom: "1px solid var(--line)", paddingBottom: 16 }}><summary style={{ color: "var(--green)", cursor: "pointer", fontSize: 20, fontWeight: 700 }}>Disease &amp; pest resistance</summary><p style={{ margin: "16px 0 0", lineHeight: 1.6 }}>{details.diseasePestResistance}</p></details>}{details.standLifeNotes && <details style={{ borderBottom: "1px solid var(--line)", paddingBottom: 16 }}><summary style={{ color: "var(--green)", cursor: "pointer", fontSize: 20, fontWeight: 700 }}>Stand life</summary><p style={{ margin: "16px 0 0", lineHeight: 1.6 }}>{details.standLifeNotes}</p></details>}</section>}
            <section style={{ display: "grid", gap: 16 }}><h2 style={{ color: "var(--green)", fontSize: 28 }}>How it&apos;s sold</h2><div className="product-table-wrap sold-table"><table><thead><tr><th>Form</th><th>Pack</th><th>Status</th></tr></thead><tbody>{product.saleLines?.map((line) => <tr key={line.stockCode}><td>{line.seedForm || "Bare"}</td><td>{line.packKg ? `${line.packKg} ${line.packUnit}` : product.packSize}</td><td className="sold-status"><StatusPill status={({ "Good stock": "in-stock", "Low stock": "low", "Very low": "very-low", Unavailable: "unavailable" }[line.availability ?? "Unavailable"] ?? product.status)} /></td></tr>)}</tbody></table></div></section>
            </div>
          </article>
          <div className="product-rail">
            <div className="product-sidebar-sticky-slot">
              <aside className="product-sidebar-col">
                <div className="product-sidebar-card mobile-order-2">
                  {quickFacts.length > 0 && <section className="quick-facts-section"><h2 className="sidebar-card-heading">Quick facts</h2><div className="quick-facts-list">{quickFacts.map((fact) => <div className="quick-fact-item" key={fact.label}><span className="quick-fact-icon"><Icon name={fact.icon} size={22} /></span><div className="quick-fact-content"><span className="quick-fact-label">{fact.label}</span><span className="quick-fact-value">{fact.value}</span></div></div>)}</div></section>}
                  <div className="pricing-section"><StatusPill status={product.status} /><div className="pricing-details"><strong className="pricing-amount">{listedPrice || "Contact for pricing"}</strong>{packLabels.length > 0 && <span className="pricing-unit">Available in {packLabels.join(", ")}</span>}</div><div className="pricing-actions"><Link href="/contact" className="button button-primary pricing-action-order">Ask about an order</Link><a className="button button-outline pricing-action-call" href={officeTel} aria-label={`Call IH Seeds on ${officePhone}`}><Icon name="phone" size={20} /></a></div><Link href="/contact#locations" className="pricing-reseller"><span className="pricing-reseller-icon"><Icon name="map-pin" size={18} /></span><span className="pricing-reseller-text">Contact a local reseller to order{resellerShops > 0 && <> - we supply over {resellerShops} independent and retail farm shops</>}</span><span className="pricing-reseller-arrow"><Icon name="arrow-right" size={18} /></span></Link><small className="pricing-disclaimer">We supply through rural resellers across Western Australia.</small></div>
                </div>
                <div className="product-sidebar-bottom mobile-order-7">
                  {(details.certification?.length || details.pbrProtected) && <div className="product-meta-section">{details.certification?.length ? <div>Certification: {details.certification.join(", ")}</div> : null}{details.pbrProtected ? <div>PBR: {details.pbrDetails || "Protected"}</div> : null}</div>}
                </div>
              </aside>
            </div>
            {photos.length > 0 && <section className="product-photos mobile-order-5" aria-labelledby="product-photos-heading"><h2 id="product-photos-heading" className="sidebar-card-heading">Photos</h2><div className="product-photos-list">{photos.map((photo, index) => <img key={`${photo.src}-${index}`} src={photo.src} alt={photoAltText(product.name, photo)} loading="lazy" width={photoDimension(photo.width)} height={photoDimension(photo.height)} />)}</div></section>}
          </div>
        </div>
      </section>
      {faqs.length > 0 && (
        <section className="product-faq-section" id="faqs" aria-labelledby="product-faq-heading">
          <div className="product-faq-inner">
            <h2 id="product-faq-heading">FAQs</h2>
            <div className="product-faq-list">
              {faqs.map((faq, index) => (
                <details className="product-faq-item" key={`${faq.question}-${index}`}>
                  <summary>{faq.question}</summary>
                  <p>{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}
      {alsoPopular.length > 0 && <section className="also-popular-section" aria-labelledby="also-popular-heading"><div className="also-popular-inner"><div className="also-popular-header"><h2 id="also-popular-heading">Also popular:</h2><Link href={categoryUrl} className="also-popular-category-link">View all {product.category}<Icon name="arrow-right" size={18} /></Link></div><div className="also-popular-grid">{alsoPopular.map((item) => <Link key={item.id} href={productPublicPath(item, categories)} className="also-popular-card"><div className="also-popular-image" role="img" aria-label={productImageAlt(item)} style={{ backgroundImage: `url(${productImage(item)})` }}>{!hasProductPhoto(item) && <img className="product-fallback-logo" src="/ih-seeds-logo.png" alt="" />}<StatusPill status={item.status} /><ProductNewStamp listingState={item.listingState} /></div><div className="also-popular-card-body"><div><h3>{item.name}</h3>{item.details.tagline?.trim() && <p>{item.details.tagline}</p>}</div><span className="also-popular-arrow" aria-hidden="true"><Icon name="arrow-right" size={18} /></span></div></Link>)}</div></div></section>}
    </>
  );
}
