import React from "react";
import { Link, useParams } from "../router";
import { useProducts, imageOptions, productPath, slugify } from "../hooks/useApi";
import { Icon, StatusPill } from "../components/ui";

export default function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { products, loading } = useProducts();
  
  const product = products.find((item) =>
    item.slug === slug ||
    item.id.toString() === slug ||
    (!item.slug && slugify(item.name) === slug),
  );

  if (loading) {
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

  const relatedProducts = (product.details?.relatedProducts ?? [])
    .map((relatedSlug) => products.find((item) => item.slug === relatedSlug))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const specs = [
    { label: "Sowing rate", value: "8–15 kg/ha alone, 3–5 kg/ha in mixes.", icon: "scale" },
    { label: "Rainfall", value: "500 mm+ (or irrigated).", icon: "cloud-rain" },
    { label: "Flowering / heading", value: "Late heading (+17 days).", icon: "calendar" },
    { label: "Ideal soil range", value: "Adaptable, prefers fertile loams and clays.", icon: "layers" }
  ];

  return (
    <>
      <div style={{ position: "relative" }}>
        <div style={{ position: "relative", minHeight: 520, backgroundImage: `url(${imageOptions[0]})`, backgroundSize: "cover", backgroundPosition: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(29,40,28,0.55) 0%, rgba(29,40,28,0.28) 45%, rgba(29,40,28,0.72) 100%)" }}></div>
           <div className="product-hero-content" style={{ position: "relative", maxWidth: 1180, margin: "0 auto", padding: "160px 40px 64px", display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--yellow)" }}>Seed Catalogue</div>
             <h1 className="product-title" style={{ margin: 0, fontSize: 64, lineHeight: 1.05, letterSpacing: "-0.01em", fontWeight: 700, color: "#FFFFFF", maxWidth: "20ch" }}>{product.name}</h1>
            <p style={{ margin: 0, fontSize: 22, lineHeight: 1.6, color: "#FFFFFF", maxWidth: "52ch" }}>{product.note}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, paddingTop: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#FFFFFF", border: "1.5px solid rgba(255,255,255,0.5)", borderRadius: 999, padding: "9px 20px" }}>{product.packSize}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#FFFFFF", border: "1.5px solid rgba(255,255,255,0.5)", borderRadius: 999, padding: "9px 20px" }}>{product.price}</span>
            </div>
          </div>
        </div>
      </div>

      <section style={{ background: "#FFFFFF" }}>
        <div className="product-detail-grid" style={{ maxWidth: 1180, margin: "0 auto", padding: "72px 40px 96px", display: "grid", gridTemplateColumns: "minmax(0,1fr) 380px", gap: 64, alignItems: "start" }}>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 48 }}>
            <p style={{ margin: 0, fontSize: 22, lineHeight: 1.5, fontWeight: 600, color: "var(--green)", maxWidth: "56ch" }}>
              A highly productive and versatile seed choice built to recover fast and persist through changing seasonal conditions.
            </p>

            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", background: "var(--sage)", padding: 24, borderRadius: 16 }}>
              {specs.slice(0, 3).map((s, i) => (
                <div key={i} style={{ flex: "1 1 200px", display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <span style={{ color: "var(--green)", marginTop: 2 }}><Icon name={s.icon} size={22} /></span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)", marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "var(--black-green)" }}>{s.value}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <h2 style={{ margin: 0, fontSize: 30, fontWeight: 700, color: "var(--green)" }}>About this variety</h2>
              <p style={{ margin: 0, fontSize: 17, lineHeight: 1.7, color: "var(--black-green)", maxWidth: "64ch" }}>
                Designed to handle heavy grazing, this seed exhibits excellent seedling vigour and early growth. It provides substantial feed during the colder months when pasture is typically short.
              </p>
              <p style={{ margin: 0, fontSize: 17, lineHeight: 1.7, color: "var(--black-green)", maxWidth: "64ch" }}>
                Carefully tested for germination and purity, it is suited to both standalone sowing or as the foundational grass in a mixed pasture sward.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <h2 style={{ margin: 0, fontSize: 30, fontWeight: 700, color: "var(--green)" }}>Specifications</h2>
              <div style={{ border: "1px solid var(--line)", borderRadius: 16, overflow: "hidden" }}>
                {specs.map((s, i) => (
                  <div className="spec-row" key={i} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 2fr)", gap: 16, padding: "18px 24px", borderBottom: i === specs.length - 1 ? "none" : "1px solid var(--line)", background: i % 2 === 0 ? "transparent" : "var(--cream)" }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--green)" }}>{s.label}</div>
                    <div style={{ fontSize: 15, lineHeight: 1.5, color: "var(--black-green)" }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="product-sidebar" style={{ display: "flex", flexDirection: "column", gap: 32, position: "sticky", top: 120 }}>
            <div style={{ background: "var(--sage)", borderRadius: 16, padding: 32, display: "flex", flexDirection: "column", gap: 24 }}>
              <StatusPill status={product.status} />
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 32, fontWeight: 700, color: "var(--green)" }}>{product.price}</div>
                <div style={{ fontSize: 15, color: "var(--muted)" }}>Available in {product.packSize}s</div>
              </div>
              <Link href="/contact" className="button button-primary" style={{ textAlign: "center" }}>Ask about an order</Link>
              <div style={{ fontSize: 14, lineHeight: 1.5, color: "var(--muted)", textAlign: "center" }}>
                We supply through rural resellers across Western Australia.
              </div>
            </div>

            {relatedProducts.length > 0 && <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--green)" }}>Related products</h3>
              {relatedProducts.map((p, i) => (
                <Link key={p.id} href={productPath(p)} style={{ display: "flex", gap: 16, textDecoration: "none", alignItems: "center", padding: 12, borderRadius: 12, border: "1px solid var(--line)" }}>
                  <div style={{ width: 64, height: 64, borderRadius: 8, backgroundImage: `url(${imageOptions[i+1]})`, backgroundSize: "cover" }} />
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "var(--green)" }}>{p.name}</div>
                    <div style={{ fontSize: 13, color: "var(--muted)" }}>{p.packSize}</div>
                  </div>
                </Link>
              ))}
            </div>}
          </div>

        </div>
      </section>
    </>
  );
}
