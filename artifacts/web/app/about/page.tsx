import type { Metadata } from "next";
import { Icon } from "../../components/Icon";
import { getProducts } from "../../lib/catalogue";
import { loadSiteSettings, publicMediaSrc } from "../../lib/site-settings";

export const metadata: Metadata = {
  title: "About IH Seeds | Western Australian Pasture Seed Specialists",
  description: "Meet the Western Australian family behind IH Seeds, supplying proven pasture seed and regional advice since 1966.",
};

const imageOptions = [
  "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1530507629858-e4977d30e9e0?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1499529112087-3cb3b73cec95?auto=format&fit=crop&w=900&q=80",
];

export default async function About() {
  const [products, settings] = await Promise.all([getProducts(), loadSiteSettings()]);
  const values = [
    { icon: "map-pin", title: "Regional expertise", body: "Local conditions, understood and applied. Sixty years of sowing across every WA rainfall zone." },
    { icon: "sprout", title: "Proven performance", body: "Varieties and mixes proven over generations across Australia, with trial data behind them." },
    { icon: "users", title: "Partnership", body: "Confidence before the order. Support after it — through your local rural reseller." }
  ];

  return (
    <>
      <section style={{ background: "var(--sage)" }}>
        <div className="page-hero-grid" style={{ maxWidth: 1180, margin: "0 auto", padding: "64px 40px 96px", display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 64, alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--green)" }}>About Us</div>
            <h1 style={{ margin: 0, fontSize: 48, lineHeight: 1.2, fontWeight: 300, color: "var(--green)" }}>Western Australian owned, <span style={{ fontWeight: 700 }}>since 1966</span></h1>
            <p style={{ margin: 0, fontSize: 18, lineHeight: 1.6, color: "var(--black-green)", maxWidth: "52ch" }}>Three generations of the Hunter family, one paddock question at a time: what will actually grow here.</p>
          </div>
          <div style={{ borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 10px rgba(29,40,28,0.10)", aspectRatio: "4/3", backgroundImage: `url(${imageOptions[2]})`, backgroundSize: "cover", backgroundPosition: "center" }}>
          </div>
        </div>
      </section>

      <section style={{ background: "#FFFFFF" }}>
        <div className="page-content" style={{ maxWidth: 900, margin: "0 auto", padding: "96px 40px", display: "flex", flexDirection: "column", gap: 32 }}>
          <p style={{ margin: 0, fontSize: 22, lineHeight: 1.6, fontWeight: 600, color: "var(--green)" }}>It started with a question every farmer in the south-west was asking: which seed will actually perform on my ground, in my rainfall, under my grazing plan.</p>
          <p style={{ margin: 0, fontSize: 17, lineHeight: 1.8, color: "var(--black-green)" }}>Irwin Hunter &amp; Co was founded in 1966 by growers who were tired of buying seed blended for somewhere else. They started sourcing, testing and blending pasture seed for Western Australian conditions specifically — not the eastern states, not overseas trial data, but paddocks from Esperance to Derby.</p>
          <p style={{ margin: 0, fontSize: 17, lineHeight: 1.8, color: "var(--black-green)" }}>Sixty years on, the company is still independently owned and run by the same family. We have watched varieties come and go, rainfall patterns shift, and three generations of resellers build their businesses alongside ours. What has not changed is the question we start with: what will actually grow here.</p>
          <p style={{ margin: 0, fontSize: 17, lineHeight: 1.8, color: "var(--black-green)" }}>Today we supply through rural resellers across the state — from the wheatbelt to the Kimberley — with true to type seed across {products.length > 0 ? `${products.length}+ varieties and mixes` : "the catalogue"} from credible growers, and the technical advice to back it. We are an Australian Seed Federation member, and every mix we blend still gets tested against the same standard the founders set: would we sow it on our own place.</p>
        </div>
      </section>

      <section style={{ background: "var(--sage)" }}>
        <div className="page-content" style={{ maxWidth: 1180, margin: "0 auto", padding: "96px 40px" }}>
          <div className="section-heading centered" style={{ justifyContent: "center" }}>
            <h2><span style={{ fontWeight: 300 }}>What we</span> <strong>stand for</strong></h2>
          </div>
          <div className="category-card-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 32, marginTop: 48 }}>
            {values.map((v, i) => (
              <div key={i} style={{ background: "#FFFFFF", border: "1px solid var(--line)", borderRadius: 16, padding: 32, display: "flex", flexDirection: "column", gap: 16 }}>
                <span style={{ color: "var(--green)", display: "flex" }}><Icon name={v.icon} size={28} /></span>
                <div style={{ fontSize: 22, fontWeight: 700, color: "var(--green)", lineHeight: 1.4 }}>{v.title}</div>
                <div style={{ fontSize: 16, lineHeight: 1.6, color: "var(--black-green)" }}>{v.body}</div>
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