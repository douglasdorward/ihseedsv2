import type { Metadata } from "next";
import { Icon } from "../../components/Icon";
import { SeedGuideBanner } from "../../components/SeedGuideBanner";
import { getProducts } from "../../lib/catalogue";
import { loadSiteSettings } from "../../lib/site-settings";
import { siteSocialMetadata } from "../../lib/social-metadata";

const metadata: Metadata = {
  title: "Tech Sheets | IH Seeds",
  description: "Download technical information for current IH Seeds varieties and mixes.",
  alternates: { canonical: "/tech-sheets" },
};

export async function generateMetadata(): Promise<Metadata> {
  return { ...metadata, ...await siteSocialMetadata(metadata.title as string, metadata.description as string, "/tech-sheets") };
}

export default async function TechSheetsPage() {
  const [products, settings] = await Promise.all([
    getProducts(),
    loadSiteSettings(),
  ]);

  return (
    <>
      <section style={{ background: "var(--sage)" }}>
        <div className="page-content resource-intro" style={{ maxWidth: 1180, margin: "0 auto", padding: "64px 40px 64px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--green)" }}>Tech Sheets</div>
          <h1 style={{ margin: 0, fontSize: 48, lineHeight: 1.2, fontWeight: 300, color: "var(--green)" }}>Download a <span style={{ fontWeight: 700 }}>tech sheet</span></h1>
          <p style={{ margin: 0, fontSize: 18, lineHeight: 1.6, color: "var(--black-green)", maxWidth: "64ch" }}>A downloadable tech sheet for every mix and variety we stock.</p>
        </div>
      </section>

      <section style={{ background: "#FFFFFF" }}>
        <div className="page-content" style={{ maxWidth: 1180, margin: "0 auto", padding: "64px 40px 96px" }}>
          {products.length === 0 ? (
            <p className="empty-state" data-testid="status-tech-sheets-empty">No tech sheets available yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", border: "1px solid var(--line)", borderRadius: 16, overflow: "hidden" }}>
              {products.map((product, index) => (
                <div className="tech-sheet-row" key={product.id} style={{ display: "grid", gridTemplateColumns: "44px minmax(0,1fr) 120px 160px", gap: 20, alignItems: "center", padding: "18px 24px", borderBottom: index === products.length - 1 ? "none" : "1px solid var(--line)" }}>
                  <span style={{ color: "var(--green)", display: "flex" }}><Icon name="file-text" size={22} /></span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "var(--green)" }}>{product.name}</div>
                    <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.45 }}>{product.details.tagline}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>2026 range</div>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <a href={`/tech-sheets/${product.slug}`} className="button button-outline" style={{ padding: "8px 16px", minHeight: "auto", fontSize: 14 }} target="_blank" rel="noreferrer">Download tech sheet</a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <SeedGuideBanner seedGuide={settings.seedGuide} />
    </>
  );
}
