import type { Metadata } from "next";
import { Icon } from "../../components/Icon";
import { getProducts } from "../../lib/catalogue";
import { expandProductCount, FALLBACK_SITE_SETTINGS, loadSiteSettings, publicMediaSrc } from "../../lib/site-settings";

export const metadata: Metadata = {
  title: "About IH Seeds | Western Australian Pasture Seed Specialists",
  description: "Meet the Western Australian family behind IH Seeds, supplying proven pasture seed and regional advice since 1966.",
  alternates: { canonical: "/about" },
};

const VALUE_ICONS = ["map-pin", "sprout", "users"] as const;

export default async function About() {
  const [products, settings] = await Promise.all([getProducts(), loadSiteSettings()]);
  const about = settings.about ?? FALLBACK_SITE_SETTINGS.about;
  const heroSrc = publicMediaSrc({ src: about.heroImageSrc, assetId: about.heroImageAssetId })
    || FALLBACK_SITE_SETTINGS.about.heroImageSrc;

  return (
    <>
      <section style={{ background: "var(--sage)" }}>
        <div className="page-hero-grid" style={{ maxWidth: 1180, margin: "0 auto", padding: "64px 40px 96px", display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 64, alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--green)" }}>{about.heroEyebrow}</div>
            <h1 style={{ margin: 0, fontSize: 48, lineHeight: 1.2, fontWeight: 300, color: "var(--green)" }}>
              {about.heroHeading}{about.heroHeadingEmphasis ? " " : ""}
              {about.heroHeadingEmphasis ? <span style={{ fontWeight: 700 }}>{about.heroHeadingEmphasis}</span> : null}
            </h1>
            <p style={{ margin: 0, fontSize: 18, lineHeight: 1.6, color: "var(--black-green)", maxWidth: "52ch" }}>{about.heroIntro}</p>
          </div>
          <div style={{ borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 10px rgba(29,40,28,0.10)", aspectRatio: "4/3", backgroundImage: `url(${heroSrc})`, backgroundSize: "cover", backgroundPosition: "center" }}>
          </div>
        </div>
      </section>

      <section style={{ background: "#FFFFFF" }}>
        <div className="page-content" style={{ maxWidth: 900, margin: "0 auto", padding: "96px 40px", display: "flex", flexDirection: "column", gap: 32 }}>
          <p style={{ margin: 0, fontSize: 22, lineHeight: 1.6, fontWeight: 600, color: "var(--green)" }}>{about.storyLead}</p>
          {about.storyParagraphs.filter((paragraph) => paragraph.trim()).map((paragraph, index) => (
            <p key={`about-story-${index}`} style={{ margin: 0, fontSize: 17, lineHeight: 1.8, color: "var(--black-green)" }}>
              {expandProductCount(paragraph, products.length)}
            </p>
          ))}
        </div>
      </section>

      <section style={{ background: "var(--sage)" }}>
        <div className="page-content" style={{ maxWidth: 1180, margin: "0 auto", padding: "96px 40px" }}>
          <div className="section-heading centered" style={{ justifyContent: "center" }}>
            <h2>
              <span style={{ fontWeight: 300 }}>{about.valuesHeading}</span>{" "}
              <strong>{about.valuesHeadingEmphasis}</strong>
            </h2>
          </div>
          <div className="category-card-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 32, marginTop: 48 }}>
            {about.values.map((value, index) => (
              <div key={`${value.title}-${index}`} style={{ background: "#FFFFFF", border: "1px solid var(--line)", borderRadius: 16, padding: 32, display: "flex", flexDirection: "column", gap: 16 }}>
                <span style={{ color: "var(--green)", display: "flex" }}><Icon name={VALUE_ICONS[index] ?? "sprout"} size={28} /></span>
                <div style={{ fontSize: 22, fontWeight: 700, color: "var(--green)", lineHeight: 1.4 }}>{value.title}</div>
                <div style={{ fontSize: 16, lineHeight: 1.6, color: "var(--black-green)" }}>{value.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ background: "#FFFFFF" }}>
        <div className="page-wide" style={{ maxWidth: 1440, margin: "0 auto", padding: "96px 40px" }}>
          <div className="guide-banner" style={{ backgroundImage: `linear-gradient(90deg, rgba(29,40,28,.92), rgba(29,40,28,.44)), url(${publicMediaSrc({ src: settings.seedGuide.cardImageSrc, assetId: settings.seedGuide.cardImageAssetId })})` }}>
            <div>
              <h2>{settings.seedGuide.cardHeading}</h2>
              <a href={settings.seedGuide.pdfPublicUrl} className="button button-light" style={{ display: "inline-block", textDecoration: "none" }} download>{settings.seedGuide.cardButtonLabel}</a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
