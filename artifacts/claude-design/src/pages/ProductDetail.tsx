import React, { useEffect, useState } from "react";
import { Link, useParams, useLocation, navigate } from "../router";
import { useProducts, imageOptions, productPath, slugify } from "../hooks/useApi";
import { Icon, StatusPill } from "../components/ui";
import { useListCategories } from "@workspace/api-client-react";

export default function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [location] = useLocation();
  const { products, loading } = useProducts();
  const { data: categories = [] } = useListCategories();
  const [redirectLookup, setRedirectLookup] = useState<{ path: string; status: "loading" | "not-found" } | null>(null);
  
  const product = products.find((item) =>
    item.slug === slug ||
    (!item.slug && slugify(item.name) === slug),
  );

  useEffect(() => {
    if (loading || product || !slug) return;

    const controller = new AbortController();
    setRedirectLookup({ path: location, status: "loading" });
    fetch(`/api/redirects/lookup?fromPath=${encodeURIComponent(location)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Redirect not found");
        const body: unknown = await response.json();
        if (
          !body ||
          typeof body !== "object" ||
          !("toPath" in body) ||
          typeof body.toPath !== "string" ||
          !body.toPath.startsWith("/")
        ) {
          throw new Error("Invalid redirect response");
        }
        navigate(body.toPath, { replace: true });
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setRedirectLookup({ path: location, status: "not-found" });
        }
      });

    return () => controller.abort();
  }, [loading, product, slug, location]);

  useEffect(() => {
    if (product) {
      document.title = `${product.details?.seoTitle || product.name} | IH Seeds`;
      const desc = document.querySelector('meta[name="description"]');
      if (desc) desc.setAttribute("content", product.details?.seoDescription || product.details?.blurb || product.note || "");
      
      const link = document.querySelector('link[rel="canonical"]');
      const canonicalUrl = `${window.location.origin}${productPath(product)}`;
      if (link) link.setAttribute("href", canonicalUrl);
      else {
        const newLink = document.createElement("link");
        newLink.rel = "canonical";
        newLink.href = canonicalUrl;
        document.head.appendChild(newLink);
      }
    }
  }, [product]);

  const redirectNotFound = redirectLookup?.path === location && redirectLookup.status === "not-found";
  if (loading || (!product && !redirectNotFound)) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="loading-state">Loading product...</div>
      </div>
    );
  }

  if (!product) {
    return (
      <section className="page-content" style={{ minHeight: "55vh", maxWidth: 1180, margin: "0 auto", padding: "96px 40px" }}>
        <h1 style={{ color: "var(--green)", fontSize: 48 }}>Product not found</h1>
        <p style={{ marginBottom: 28 }}>That product is not part of the current online range.</p>
        <Link href="/products" className="button button-primary">Browse the catalogue</Link>
      </section>
    );
  }

  const d = product.details;
  const hasComponentRates = d.components.some((component) => component.inclusionRate != null);
  const categoryMeta = categories.find((category) => category.parentId === null && category.name === product.category);
  const categorySlug = categoryMeta?.slug || slugify(product.category);
  const productPhoto = d.photos.find((photo) => photo.src.trim())?.src;
  const heroImage = productPhoto || imageOptions[0];
  const relatedProducts = (d?.relatedProducts ?? [])
    .map((relatedSlug) => products.find((item) => item.slug === relatedSlug))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const alsoPopularProducts = products
    .filter((item) => item.id !== product.id && item.category === product.category)
    .sort((a, b) =>
      Number(b.details.featured) - Number(a.details.featured) ||
      (a.details.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.details.sortOrder ?? Number.MAX_SAFE_INTEGER) ||
      a.name.localeCompare(b.name),
    )
    .slice(0, 3);

  // Quick facts
  const quickFacts = [];
  if (d.persistencyType) quickFacts.push({ label: "Type & persistency", value: d.persistencyType, icon: "leaf" });
  if (d.rainfallMinMm) quickFacts.push({ label: "Min rainfall", value: `${d.rainfallMinMm} mm+`, icon: "cloud-rain" });
  if (d.soilRangeLightest && d.soilRangeHeaviest && d.soilPhMin && d.soilPhScale) {
    quickFacts.push({ label: "Soil & pH", value: `${d.soilRangeLightest}–${d.soilRangeHeaviest}, pH ${d.soilPhMin}+ (${d.soilPhScale})`, icon: "layers" });
  }
  if (d.sowingRates && d.sowingRates.length > 0) {
    const rateStrs = d.sowingRates.map(r => `${r.min}–${r.max} ${r.unit} ${r.context}`).join(", ");
    quickFacts.push({ label: "Sowing rate", value: rateStrs, icon: "scale" });
  }
  if (d.tolerance && d.tolerance.length > 0) {
    const tolStrs = d.tolerance.map(t => t.mild ? `Mild ${t.name}` : t.name).join(", ");
    quickFacts.push({ label: "Tolerances", value: tolStrs, icon: "shield" });
  }
  if (d.endUse && d.endUse.length > 0) {
    quickFacts.push({ label: "End use", value: d.endUse.join(", "), icon: "target" });
  }
  if (d.livestock && d.livestock.length > 0) {
    quickFacts.push({ label: "Livestock", value: d.livestock.join(", "), icon: "paw-print" });
  }

  // Category-specific quick facts
  if (product.category === "Ryegrasses" || product.category === "Fescues & Other Grasses" || product.category === "Sub-Tropical Grasses") {
    if (d.ploidy) quickFacts.push({ label: "Ploidy", value: d.ploidy, icon: "layers" });
  }
  if (product.category === "Ryegrasses" || product.category === "Fescues & Other Grasses") {
    if (d.headingDate) quickFacts.push({ label: "Heading date", value: d.headingDate, icon: "calendar" });
    if (d.endophyte) quickFacts.push({ label: "Endophyte", value: d.endophyte, icon: "sprout" });
  }
  if (product.category === "Ryegrasses") {
    if (d.headingOffsetDays) quickFacts.push({ label: "Heading offset", value: `${d.headingOffsetDays} days vs Nui`, icon: "clock" });
    if (d.argtResistant) quickFacts.push({ label: "ARGT resistance", value: "Resistant", icon: "shield" });
  }
  if (product.category === "Clovers" || product.category === "Serradellas & Medics") {
    if (d.maturityDays) quickFacts.push({ label: "Days to flowering", value: d.maturityDays, icon: "calendar" });
    if (d.hardSeedLevel) quickFacts.push({ label: "Hard seed level", value: d.hardSeedLevel, icon: "shield" });
    if (d.flowerColour) quickFacts.push({ label: "Flower colour", value: d.flowerColour, icon: "flower" });
  }
  if (product.category === "Clovers") {
    if (d.oestrogenLevel) quickFacts.push({ label: "Oestrogen level", value: d.oestrogenLevel, icon: "activity" });
  }
  if (product.category === "Clovers" || product.category === "Serradellas & Medics") {
    if (d.bloatRisk) quickFacts.push({ label: "Bloat risk", value: d.bloatRisk, icon: "shield" });
  }
  if (product.category === "Lucerne") {
    if (d.winterActivity) quickFacts.push({ label: "Winter activity", value: d.winterActivity, icon: "cloud-rain" });
  }
  if (product.category === "Fescues & Other Grasses" || product.category === "Sub-Tropical Grasses") {
    if (d.growthSeason) quickFacts.push({ label: "Growth season", value: d.growthSeason, icon: "sun" });
  }
  if (product.category === "Forage & Grain Crops") {
    if (d.growingSeason) quickFacts.push({ label: "Growing season", value: d.growingSeason, icon: "sun" });
    if (d.weeksToFirstGrazing) quickFacts.push({ label: "Weeks to first grazing", value: d.weeksToFirstGrazing, icon: "clock" });
    if (d.prussicAcidRisk) quickFacts.push({ label: "Prussic acid risk", value: d.prussicAcidRisk, icon: "shield" });
    if (d.regrowth) quickFacts.push({ label: "Regrowth", value: d.regrowth, icon: "sprout" });
  }
  if (product.category === "Biologicals") {
    if (d.productForm) quickFacts.push({ label: "Product form", value: d.productForm, icon: "package" });
    if (d.applicationRate) quickFacts.push({ label: "Application rate", value: d.applicationRate, icon: "scale" });
  }

  // Schema markup
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.name,
    "brand": { "@type": "Brand", "name": "IH Seeds" },
    "description": d.seoDescription || d.blurb || product.note,
    ...(productPhoto ? { "image": productPhoto } : {}),
    "additionalProperty": quickFacts.map(q => ({
      "@type": "PropertyValue",
      "name": q.label,
      "value": q.value
    }))
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div style={{ position: "relative" }}>
        <div style={{ position: "relative", minHeight: 520, backgroundImage: `url(${heroImage})`, backgroundSize: "cover", backgroundPosition: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(29,40,28,0.55) 0%, rgba(29,40,28,0.28) 45%, rgba(29,40,28,0.72) 100%)" }}></div>
           <div className="product-hero-content" style={{ position: "relative", maxWidth: 1180, margin: "0 auto", padding: "160px 40px 64px", display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--yellow)" }}>
               <Link href="/products" style={{ color: "inherit", textDecoration: "none" }}>Products</Link> › <Link href={`/products/${categorySlug}`} style={{ color: "inherit", textDecoration: "none" }}>{product.category}</Link>
            </div>
             <h1 className="product-title" style={{ margin: 0, fontSize: 64, lineHeight: 1.05, letterSpacing: "-0.01em", fontWeight: 700, color: "#FFFFFF", maxWidth: "20ch" }}>{product.name}</h1>
              {d.tagline && <p className="product-hero-tagline">{d.tagline}</p>}
              {d.botanicalName && <div style={{ fontSize: 20, fontStyle: "italic", color: "#C5CCC5" }}>{d.botanicalName}</div>}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, paddingTop: 8, alignItems: "center" }}>
              <StatusPill status={product.status} />
              {product.techSheet && (
                <a href={`/tech-sheets/${product.techSheet}`} className="button button-primary" style={{ marginLeft: 16 }} target="_blank" rel="noreferrer">Download tech sheet</a>
              )}
            </div>
          </div>
        </div>
      </div>

      <section style={{ background: "#FFFFFF" }}>
        <div className="product-detail-grid">
          
          <div className="product-main-col">
            {d.blurb && (
              <p className="product-blurb mobile-order-1">
                {d.blurb}
              </p>
            )}

            {d.keyAttributes?.filter((attribute) => attribute.trim()).length > 0 && (
              <section className="product-key-attributes mobile-order-3" aria-labelledby="key-attributes-heading">
                <h2 id="key-attributes-heading">Key attributes</h2>
                <ul>
                  {d.keyAttributes.filter((attribute) => attribute.trim()).map((attribute, index) => (
                    <li key={`${attribute}-${index}`}>{attribute}</li>
                  ))}
                </ul>
              </section>
            )}

            <div className="product-main-rest mobile-order-4">
              {d.distributionNote?.trim() && (
                <aside className="product-distribution-note" aria-label="Distribution information">
                  <Icon name="info" size={22} />
                  <p>{d.distributionNote}</p>
                </aside>
              )}

              {d.recordType === "Mix" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <h4 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "var(--green)" }}>Mix Components</h4>
                  {d.formulationYear && <div style={{ fontSize: 14, color: "var(--muted)" }}>Formulation {d.formulationYear}</div>}
                  <div className="product-table-wrap" style={{ border: "1px solid var(--line)", borderRadius: 16 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                      <thead>
                        <tr style={{ background: "var(--sage)", color: "var(--green)", fontSize: 14 }}>
                          <th style={{ padding: "12px 16px", borderBottom: "2px solid #C5CCC5" }}>Component</th>
                          {hasComponentRates && <th style={{ padding: "12px 16px", borderBottom: "2px solid #C5CCC5" }}>Rate</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {d.components.map((component, i) => {
                          const componentProduct = products.find((item) => item.slug === component.productLink);
                          const componentDescription = (component.description ?? "").trim();
                          return (
                          <tr key={i} style={{ borderBottom: "1px solid var(--line)" }}>
                            <td className="mix-component-cell">
                              <div className="mix-component-name">
                                {componentProduct
                                  ? <Link href={productPath(componentProduct)}>{component.speciesName}</Link>
                                  : component.speciesName}
                              </div>
                              {componentDescription && <div className="mix-component-description">{componentDescription}</div>}
                            </td>
                            {hasComponentRates && <td style={{ padding: "12px 16px" }}>
                              {component.inclusionRate !== null
                                ? `${component.inclusionRate}${component.unit ? `${component.unit === "%" ? "" : " "}${component.unit}` : ""}`
                                : "—"}
                            </td>}
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {d.description && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <h2 style={{ margin: 0, fontSize: 30, fontWeight: 700, color: "var(--green)" }}>About this variety</h2>
                  {d.description.split(/\n\s*\n/).filter((paragraph) => paragraph.trim()).map((p, i) => (
                    <p key={i} style={{ margin: 0, fontSize: 17, lineHeight: 1.7, color: "var(--black-green)", maxWidth: "64ch" }}>
                      {p.trim()}
                    </p>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {d.grazingManagementNotes && (
                  <details style={{ borderBottom: "1px solid var(--line)", paddingBottom: 16 }}>
                    <summary style={{ fontSize: 20, fontWeight: 700, color: "var(--green)", cursor: "pointer", listStyle: "none" }}>Planting & grazing notes</summary>
                    <p style={{ margin: "16px 0 0", fontSize: 16, lineHeight: 1.6, color: "var(--black-green)" }}>{d.grazingManagementNotes}</p>
                  </details>
                )}
                {d.diseasePestResistance && (
                  <details style={{ borderBottom: "1px solid var(--line)", paddingBottom: 16 }}>
                    <summary style={{ fontSize: 20, fontWeight: 700, color: "var(--green)", cursor: "pointer", listStyle: "none" }}>Disease & pest resistance</summary>
                    <p style={{ margin: "16px 0 0", fontSize: 16, lineHeight: 1.6, color: "var(--black-green)" }}>{d.diseasePestResistance}</p>
                  </details>
                )}
                {d.standLifeNotes && (
                  <details style={{ borderBottom: "1px solid var(--line)", paddingBottom: 16 }}>
                    <summary style={{ fontSize: 20, fontWeight: 700, color: "var(--green)", cursor: "pointer", listStyle: "none" }}>Stand life</summary>
                    <p style={{ margin: "16px 0 0", fontSize: 16, lineHeight: 1.6, color: "var(--black-green)" }}>{d.standLifeNotes}</p>
                  </details>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <h2 style={{ margin: 0, fontSize: 30, fontWeight: 700, color: "var(--green)" }}>How it's sold</h2>
                <div className="product-table-wrap" style={{ border: "1px solid var(--line)", borderRadius: 16 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                    <thead>
                      <tr style={{ background: "var(--sage)", color: "var(--green)", fontSize: 14 }}>
                        <th style={{ padding: "12px 16px", borderBottom: "2px solid #C5CCC5" }}>Form</th>
                        <th style={{ padding: "12px 16px", borderBottom: "2px solid #C5CCC5" }}>Pack</th>
                        <th style={{ padding: "12px 16px", borderBottom: "2px solid #C5CCC5" }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {product.saleLines?.map((line, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid var(--line)" }}>
                          <td style={{ padding: "12px 16px", fontWeight: 600, color: "var(--green)" }}>{line.seedForm || "Bare"}</td>
                          <td style={{ padding: "12px 16px" }}>{line.packKg ? `${line.packKg} ${line.packUnit}` : "—"}</td>
                          <td style={{ padding: "12px 16px" }}>
                             {line.availability
                               ? <StatusPill status={({ "Good stock": "in-stock", "Low stock": "low", "Very low": "very-low", Unavailable: "unavailable" } as any)[line.availability]} />
                               : <span style={{ color: "var(--muted)", fontWeight: 600 }}>TBA</span>}
                          </td>
                        </tr>
                      ))}
                      {(!product.saleLines || product.saleLines.length === 0) && (
                        <tr>
                           <td colSpan={3} style={{ padding: "12px 16px", color: "var(--muted)", textAlign: "center" }}>No active sale lines</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <div className="product-sidebar-col">
            <div className="product-sidebar-card mobile-order-2">
              {quickFacts.length > 0 && (
                <section className="quick-facts-section" aria-labelledby="quick-facts-heading">
                  <h2 id="quick-facts-heading" className="sidebar-card-heading">Quick facts</h2>
                  <div className="quick-facts-list">
                    {quickFacts.map((s, i) => (
                      <div key={i} className="quick-fact-item">
                        <span className="quick-fact-icon">{s.icon && <Icon name={s.icon as any} size={22} />}</span>
                        <div className="quick-fact-content">
                          <div className="quick-fact-label">{s.label}</div>
                          <div className="quick-fact-value">{s.value}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <div className="pricing-section">
                <StatusPill status={product.status} />
                <div className="pricing-details">
                  <div className="pricing-amount">{product.saleLines?.[0]?.priceDisplay || "Contact for pricing"}</div>
                  <div className="pricing-unit">Available in {product.saleLines?.[0]?.packKg ? `${product.saleLines?.[0]?.packKg} ${product.saleLines?.[0]?.packUnit}` : product.packSize}</div>
                </div>
                <Link href="/contact" className="button button-primary" style={{ textAlign: "center", width: "100%" }}>Ask about an order</Link>
                <div className="pricing-disclaimer">
                  We supply through rural resellers across Western Australia.
                </div>
              </div>
            </div>

            <div className="product-sidebar-bottom mobile-order-5">
              {relatedProducts.length > 0 && (
                <div className="related-products-section">
                  <h3 className="sidebar-bottom-heading">Related products</h3>
                  <div className="related-products-list">
                    {relatedProducts.map((p, i) => (
                      <Link key={p.id} href={productPath(p)} className="related-product-card">
                        <div className="related-product-image" style={{ backgroundImage: `url(${imageOptions[i%imageOptions.length]})` }} />
                        <div className="related-product-info">
                          <div className="related-product-name">{p.name}</div>
                          <div className="related-product-tagline">{p.details.tagline}</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              <div className="product-meta-section">
                {d.certification.length > 0 && <div>Certification: {d.certification.join(", ")}</div>}
                {d.pbrProtected && <div>PBR: {d.pbrDetails || "Protected"}</div>}
              </div>
            </div>
          </div>

        </div>
      </section>

      {alsoPopularProducts.length > 0 && (
        <section className="also-popular-section" aria-labelledby="also-popular-heading">
          <div className="also-popular-inner">
            <div className="also-popular-header">
              <h2 id="also-popular-heading">Also popular:</h2>
              <Link href={`/products/${categorySlug}`} className="also-popular-category-link">
                View all {product.category}
                <Icon name="arrow-right" size={18} />
              </Link>
            </div>
            <div className="also-popular-grid">
              {alsoPopularProducts.map((item, index) => {
                const image = item.details.photos.find((photo) => photo.src.trim())?.src || imageOptions[(index + 1) % imageOptions.length];
                return (
                  <Link key={item.id} href={productPath(item)} className="also-popular-card">
                    <div
                      className="also-popular-image"
                      role="img"
                      aria-label={item.name}
                      style={{ backgroundImage: `url(${image})` }}
                    >
                      <StatusPill status={item.status} />
                    </div>
                    <div className="also-popular-card-body">
                      <div>
                        <h3>{item.name}</h3>
                        {item.details.tagline?.trim() && <p>{item.details.tagline}</p>}
                      </div>
                      <span className="also-popular-arrow" aria-hidden="true">
                        <Icon name="arrow-right" size={18} />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
