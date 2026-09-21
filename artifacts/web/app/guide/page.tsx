import type { Metadata } from "next";
import Link from "next/link";
import { loadSiteSettings, publicMediaSrc } from "../../lib/site-settings";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await loadSiteSettings();
  return {
    title: `${settings.seedGuide.pageTitle} | IH Seeds`,
    description: settings.seedGuide.pageIntro,
    alternates: { canonical: "/guide" },
  };
}

export default async function Guide() {
  const settings = await loadSiteSettings();
  const guide = settings.seedGuide;

  return (
    <>
      <section style={{ background: "#FFFFFF" }}>
        <div className="page-hero-grid" style={{ maxWidth: 1180, margin: "0 auto", padding: "96px 40px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--green)" }}>Publication</div>
            <h1 style={{ margin: 0, fontSize: 56, lineHeight: 1.1, fontWeight: 800, color: "var(--green)" }}>{guide.pageTitle}</h1>
            <p style={{ fontSize: 20, lineHeight: 1.6, color: "var(--black-green)" }}>
              {guide.pageIntro}
            </p>
            <div style={{ marginTop: 16 }}>
              <a href={guide.pdfPublicUrl} className="button button-primary" style={{ display: "inline-block", textDecoration: "none" }} download>{guide.pageButtonLabel}</a>
            </div>
          </div>
          <div style={{ borderRadius: 24, overflow: "hidden", boxShadow: "0 20px 40px rgba(29,40,28,0.15)", background: "var(--sage)" }}>
            <img src={publicMediaSrc({ src: guide.cardImageSrc, assetId: guide.cardImageAssetId })} alt={`${guide.pageTitle} cover`} style={{ display: "block", width: "100%", height: 500, objectFit: "cover" }} />
          </div>
        </div>
      </section>
      
      <section style={{ background: "var(--sage)" }}>
        <div className="page-content" style={{ maxWidth: 1180, margin: "0 auto", padding: "96px 40px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 32, alignItems: "center", textAlign: "center" }}>
            <h2 style={{ fontSize: 36, fontWeight: 700, color: "var(--green)" }}>Need hard copies for the store?</h2>
            <p style={{ fontSize: 18, maxWidth: "60ch", lineHeight: 1.6 }}>We supply printed guides to rural resellers across the state. If you need a stack for your counter, let us know and we'll send them out.</p>
            <Link href="/contact" className="button button-outline">Request printed copies</Link>
          </div>
        </div>
      </section>
    </>
  );
}
