import React, { useEffect, useState } from "react";
import { Link, useParams, useLocation, navigate } from "../router";
import { useProducts, imageOptions, productPath, slugify } from "../hooks/useApi";
import { Icon, StatusPill } from "../components/ui";

export default function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [location] = useLocation();
  const { products, loading } = useProducts();
  const [lookupError, setLookupError] = useState(false);
  
  const product = products.find((item) =>
    item.slug === slug ||
    item.id.toString() === slug ||
    (!item.slug && slugify(item.name) === slug),
  );

  useEffect(() => {
    if (!loading && !product && slug) {
      // Not found in active products, try lookup
      fetch(`/api/redirects/lookup?fromPath=${encodeURIComponent(location)}`)
        .then(res => {
          if (res.ok) return res.text();
          throw new Error();
        })
        .then(redirectUrl => {
          if (redirectUrl) navigate(redirectUrl, true);
          else setLookupError(true);
        })
        .catch(() => setLookupError(true));
    }
  }, [loading, product, slug, location]);

  useEffect(() => {
    if (product) {
      document.title = `${product.details?.seoTitle || product.name} | IH Seeds`;
      const desc = document.querySelector('meta[name="description"]');
      if (desc) desc.setAttribute("content", product.details?.seoDescription || product.note || "");
      
      const link = document.querySelector('link[rel="canonical"]');
      if (link) link.setAttribute("href", `${window.location.origin}/products/${product.slug}`);
      else {
        const newLink = document.createElement("link");
        newLink.rel = "canonical";
        newLink.href = `${window.location.origin}/products/${product.slug}`;
        document.head.appendChild(newLink);
      }
    }
  }, [product]);

  if (loading || (!product && !lookupError)) {
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
  const relatedProducts = (d?.relatedProducts ?? [])
    .map((relatedSlug) => products.find((item) => item.slug === relatedSlug))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

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

  // Category specific details row
  const catSpecs = [];
  if (product.category === "Ryegrasses" || product.category === "Fescues & Other Grasses" || product.category === "Sub-Tropical Grasses") {
    if (d.ploidy) catSpecs.push({ label: "Ploidy", value: d.ploidy });
  }
  if (product.category === "Ryegrasses" || product.category === "Fescues & Other Grasses") {
    if (d.headingDate) catSpecs.push({ label: "Heading date", value: d.headingDate });
    if ((d as any).endophyte) catSpecs.push({ label: "Endophyte", value: (d as any).endophyte });
  }
  if (product.category === "Ryegrasses") {
    if ((d as any).headingOffsetDays) catSpecs.push({ label: "Heading offset", value: `${(d as any).headingOffsetDays} days vs Nui` });
    if ((d as any).argtResistant) catSpecs.push({ label: "ARGT resistance", value: "Resistant" });
  }
  if (product.category === "Clovers" || product.category === "Serradellas & Medics") {
    if (d.maturityDays) catSpecs.push({ label: "Days to flowering", value: d.maturityDays });
    if ((d as any).hardSeedLevel) catSpecs.push({ label: "Hard seed level", value: (d as any).hardSeedLevel });
    if (d.flowerColour) catSpecs.push({ label: "Flower colour", value: d.flowerColour });
  }
  if (product.category === "Clovers") {
    if ((d as any).oestrogenLevel) catSpecs.push({ label: "Oestrogen level", value: (d as any).oestrogenLevel });
  }
  if (product.category === "Clovers" || product.category === "Serradellas & Medics") {
    if ((d as any).bloatRisk) catSpecs.push({ label: "Bloat risk", value: (d as any).bloatRisk });
  }
  if (product.category === "Lucerne") {
    const wa = d.maturityMeasure === "Winter activity rating" ? d.maturityDays : (d as any).winterActivity;
    if (wa) catSpecs.push({ label: "Winter activity", value: wa });
  }
  if (product.category === "Fescues & Other Grasses" || product.category === "Sub-Tropical Grasses") {
    if ((d as any).growthSeason) catSpecs.push({ label: "Growth season", value: (d as any).growthSeason });
  }
  if (product.category === "Forage & Grain Crops") {
    if ((d as any).growingSeason) catSpecs.push({ label: "Growing season", value: (d as any).growingSeason });
    if ((d as any).weeksToFirstGrazing) catSpecs.push({ label: "Weeks to first grazing", value: (d as any).weeksToFirstGrazing });
    if ((d as any).prussicAcidRisk) catSpecs.push({ label: "Prussic acid risk", value: (d as any).prussicAcidRisk });
    if ((d as any).regrowth) catSpecs.push({ label: "Regrowth", value: (d as any).regrowth });
  }
  if (product.category === "Biologicals") {
    if ((d as any).productForm) catSpecs.push({ label: "Product form", value: (d as any).productForm });
    if ((d as any).applicationRate) catSpecs.push({ label: "Application rate", value: (d as any).applicationRate });
  }

  // Schema markup
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.name,
    "brand": { "@type": "Brand", "name": "IH Seeds" },
    "description": d.seoDescription || product.note,
    "image": imageOptions[0], // we would use real image if available
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
        <div style={{ position: "relative", minHeight: 520, backgroundImage: `url(${imageOptions[0]})`, backgroundSize: "cover", backgroundPosition: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(29,40,28,0.55) 0%, rgba(29,40,28,0.28) 45%, rgba(29,40,28,0.72) 100%)" }}></div>
           <div className="product-hero-content" style={{ position: "relative", maxWidth: 1180, margin: "0 auto", padding: "160px 40px 64px", display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--yellow)" }}>
              <Link href="/products" style={{ color: "inherit", textDecoration: "none" }}>Products</Link> › <Link href={`/category/${product.category.toLowerCase()}`} style={{ color: "inherit", textDecoration: "none" }}>{product.category}</Link>
            </div>
             <h1 className="product-title" style={{ margin: 0, fontSize: 64, lineHeight: 1.05, letterSpacing: "-0.01em", fontWeight: 700, color: "#FFFFFF", maxWidth: "20ch" }}>{product.name}</h1>
             {d.botanicalName && <div style={{ fontSize: 20, fontStyle: "italic", color: "#C5CCC5" }}>{d.botanicalName}</div>}
            <p style={{ margin: 0, fontSize: 22, lineHeight: 1.6, color: "#FFFFFF", maxWidth: "52ch" }}>{product.note}</p>
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
        <div className="product-detail-grid" style={{ maxWidth: 1180, margin: "0 auto", padding: "72px 40px 96px", display: "grid", gridTemplateColumns: "minmax(0,1fr) 380px", gap: 64, alignItems: "start" }}>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 48 }}>
            {d.summary && (
              <p style={{ margin: 0, fontSize: 22, lineHeight: 1.5, fontWeight: 600, color: "var(--green)", maxWidth: "56ch" }}>
                {d.summary}
              </p>
            )}

            {quickFacts.length > 0 && (
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", background: "var(--sage)", padding: 24, borderRadius: 16 }}>
                {quickFacts.map((s, i) => (
                  <div key={i} style={{ flex: "1 1 200px", display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <span style={{ color: "var(--green)", marginTop: 2 }}>{s.icon && <Icon name={s.icon as any} size={22} />}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)", marginBottom: 4 }}>{s.label}</div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--black-green)" }}>{s.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {product.category === "Mixes" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <h4 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "var(--green)" }}>Mix Components</h4>
                {d.formulationYear && <div style={{ fontSize: 14, color: "var(--muted)" }}>Formulation {d.formulationYear}</div>}
                <div style={{ border: "1px solid var(--line)", borderRadius: 16, overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                    <thead>
                      <tr style={{ background: "var(--sage)", color: "var(--green)", fontSize: 14 }}>
                        <th style={{ padding: "12px 16px", borderBottom: "2px solid #C5CCC5" }}>Component</th>
                        <th style={{ padding: "12px 16px", borderBottom: "2px solid #C5CCC5" }}>Rate</th>
                        <th style={{ padding: "12px 16px", borderBottom: "2px solid #C5CCC5" }}>Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.mixComponents?.map((c: any, i: number) => (
                        <tr key={i} style={{ borderBottom: "1px solid var(--line)" }}>
                          <td style={{ padding: "12px 16px", fontWeight: 600, color: "var(--green)" }}>
                            {c.componentSlug ? <Link href={`/products/${c.componentSlug}`} style={{ color: "inherit" }}>{c.componentName}</Link> : c.componentName}
                          </td>
                          <td style={{ padding: "12px 16px" }}>{c.ratePercentage ? `${c.ratePercentage}%` : "—"}</td>
                          <td style={{ padding: "12px 16px" }}>{c.note || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : product.category !== "Herbs" && catSpecs.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <h4 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "var(--green)" }}>{product.category} details</h4>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", background: "var(--sage)", padding: 24, borderRadius: 16 }}>
                  {catSpecs.map((s, i) => (
                    <div key={i} style={{ flex: "1 1 200px" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)", marginBottom: 4 }}>{s.label}</div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--black-green)" }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {d.description && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <h2 style={{ margin: 0, fontSize: 30, fontWeight: 700, color: "var(--green)" }}>About this variety</h2>
                {d.description.split("\n\n").map((p, i) => (
                  <p key={i} style={{ margin: 0, fontSize: 17, lineHeight: 1.7, color: "var(--black-green)", maxWidth: "64ch" }}>
                    {p}
                  </p>
                ))}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {(d as any).grazingManagementNotes && (
                <details style={{ borderBottom: "1px solid var(--line)", paddingBottom: 16 }}>
                  <summary style={{ fontSize: 20, fontWeight: 700, color: "var(--green)", cursor: "pointer", listStyle: "none" }}>Planting & grazing notes</summary>
                  <p style={{ margin: "16px 0 0", fontSize: 16, lineHeight: 1.6, color: "var(--black-green)" }}>{(d as any).grazingManagementNotes}</p>
                </details>
              )}
              {d.diseasePestResistance && (
                <details style={{ borderBottom: "1px solid var(--line)", paddingBottom: 16 }}>
                  <summary style={{ fontSize: 20, fontWeight: 700, color: "var(--green)", cursor: "pointer", listStyle: "none" }}>Disease & pest resistance</summary>
                  <p style={{ margin: "16px 0 0", fontSize: 16, lineHeight: 1.6, color: "var(--black-green)" }}>{d.diseasePestResistance}</p>
                </details>
              )}
              {(d as any).standLifeNotes && (
                <details style={{ borderBottom: "1px solid var(--line)", paddingBottom: 16 }}>
                  <summary style={{ fontSize: 20, fontWeight: 700, color: "var(--green)", cursor: "pointer", listStyle: "none" }}>Stand life</summary>
                  <p style={{ margin: "16px 0 0", fontSize: 16, lineHeight: 1.6, color: "var(--black-green)" }}>{(d as any).standLifeNotes}</p>
                </details>
              )}
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <h2 style={{ margin: 0, fontSize: 30, fontWeight: 700, color: "var(--green)" }}>How it's sold</h2>
              <div style={{ border: "1px solid var(--line)", borderRadius: 16, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead>
                    <tr style={{ background: "var(--sage)", color: "var(--green)", fontSize: 14 }}>
                      <th style={{ padding: "12px 16px", borderBottom: "2px solid #C5CCC5" }}>Form</th>
                      <th style={{ padding: "12px 16px", borderBottom: "2px solid #C5CCC5" }}>Grade</th>
                      <th style={{ padding: "12px 16px", borderBottom: "2px solid #C5CCC5" }}>Pack</th>
                      <th style={{ padding: "12px 16px", borderBottom: "2px solid #C5CCC5" }}>Status</th>
                      <th style={{ padding: "12px 16px", borderBottom: "2px solid #C5CCC5" }}>Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.saleLines?.map((line, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--line)" }}>
                        <td style={{ padding: "12px 16px", fontWeight: 600, color: "var(--green)" }}>{line.seedForm || "Bare"}</td>
                        <td style={{ padding: "12px 16px" }}>{line.seedGrade || "—"}</td>
                        <td style={{ padding: "12px 16px" }}>{line.packKg ? `${line.packKg} ${line.packUnit}` : "—"}</td>
                        <td style={{ padding: "12px 16px" }}>
                           <StatusPill status={({ "Good stock": "in-stock", "Low stock": "low", "Very low": "very-low", Unavailable: "unavailable" } as any)[line.availability]} />
                        </td>
                        <td style={{ padding: "12px 16px", color: "var(--muted)" }}>{line.priceDisplay}</td>
                      </tr>
                    ))}
                    {(!product.saleLines || product.saleLines.length === 0) && (
                      <tr>
                         <td colSpan={5} style={{ padding: "12px 16px", color: "var(--muted)", textAlign: "center" }}>No active sale lines</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="product-sidebar" style={{ display: "flex", flexDirection: "column", gap: 32, position: "sticky", top: 120 }}>
            <div style={{ background: "var(--sage)", borderRadius: 16, padding: 32, display: "flex", flexDirection: "column", gap: 24 }}>
              <StatusPill status={product.status} />
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 32, fontWeight: 700, color: "var(--green)" }}>{product.saleLines?.[0]?.priceDisplay || "Contact for pricing"}</div>
                <div style={{ fontSize: 15, color: "var(--muted)" }}>Available in {product.saleLines?.[0]?.packKg ? `${product.saleLines?.[0]?.packKg} ${product.saleLines?.[0]?.packUnit}` : product.packSize}</div>
              </div>
              <Link href="/contact" className="button button-primary" style={{ textAlign: "center" }}>Ask about an order</Link>
              <div style={{ fontSize: 14, lineHeight: 1.5, color: "var(--muted)", textAlign: "center" }}>
                We supply through rural resellers across Western Australia.
              </div>
            </div>

            {relatedProducts.length > 0 && <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--green)" }}>Related products</h3>
              {relatedProducts.map((p, i) => (
                <Link key={p.id} href={productPath(p)} style={{ display: "flex", gap: 16, textDecoration: "none", alignItems: "center", padding: 12, borderRadius: 12, border: "1px solid var(--line)", background: "#fff" }}>
                  <div style={{ width: 64, height: 64, borderRadius: 8, backgroundImage: `url(${imageOptions[i%imageOptions.length]})`, backgroundSize: "cover" }} />
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "var(--green)" }}>{p.name}</div>
                    <div style={{ fontSize: 13, color: "var(--muted)" }}>{p.packSize}</div>
                  </div>
                </Link>
              ))}
            </div>}

            <div style={{ fontSize: 12, color: "#75766E", marginTop: 16 }}>
              {d.bredByOrigin && <div style={{ marginBottom: 4 }}>Bred by: {d.bredByOrigin}</div>}
              {d.distributedBy && <div style={{ marginBottom: 4 }}>Distributed by: {d.distributedBy}</div>}
              {(d as any).certification && <div style={{ marginBottom: 4 }}>Certification: {(d as any).certification}</div>}
              {(d as any).pbrStatus && <div style={{ marginBottom: 4 }}>PBR: {(d as any).pbrStatus}</div>}
            </div>
          </div>

        </div>
      </section>
    </>
  );
}
