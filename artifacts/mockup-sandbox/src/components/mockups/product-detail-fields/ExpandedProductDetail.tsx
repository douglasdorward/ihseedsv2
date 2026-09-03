import { useState, type ReactNode } from "react";
import { ArrowRight, Check, ChevronRight, Leaf, Menu, ShieldCheck } from "lucide-react";
import "./_group.css";

const packs = ["5 kg", "10 kg", "20 kg"];
const tags = ["Grazing", "Hay", "Silage", "Beef", "Dairy", "Sheep"];

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="ih-field"><dt>{label}</dt><dd>{children}</dd></div>;
}

export default function ExpandedProductDetail() {
  const [pack, setPack] = useState("10 kg");
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="ih-expanded-product">
      <header className="ih-topbar">
        <div className="ih-brand"><span className="ih-brand-mark"><Leaf size={17} /></span> IH Seeds</div>
        <nav className="ih-topnav" aria-label="Primary navigation">
          <button className="ih-nav-active">Seed catalogue</button><button>Growing advice</button><button>Our network</button>
          <button className="ih-top-action">Find a reseller</button>
        </nav>
        <button className="ih-top-action" aria-label="Open menu" onClick={() => setMenuOpen(!menuOpen)}><Menu size={18} /></button>
      </header>
      {menuOpen && <div style={{ padding: "12px 20px", background: "#fff3cf", color: "#705600", textAlign: "center", fontSize: 12 }}>Catalogue navigation · Find seed by species, use or soil fit.</div>}
      <div className="ih-crumbs"><span>Catalogue</span><ChevronRight size={13} /><span>Pasture mixes</span><ChevronRight size={13} /><strong>SouWest Pasture Mix</strong></div>
      <section className="ih-hero">
        <div className="ih-hero-copy">
          <div className="ih-eyebrow">Pasture mix · SWM-026</div>
          <h1>SouWest <em>Pasture Mix</em></h1>
          <p className="ih-lead">A dependable southern pasture blend for Western Australian growers who need quick feed, flexible establishment and persistence across a working season.</p>
          <div className="ih-meta-line"><span className="ih-chip"><Check size={14} /> In stock</span><span className="ih-chip">2026 guide inclusion</span><span className="ih-chip gold"><ShieldCheck size={14} /> ECOCERT approved</span></div>
        </div>
        <div className="ih-hero-art" role="img" aria-label="SouWest pasture established across a broad Western Australian paddock"><span className="ih-art-label">Field image · Great Southern WA</span></div>
      </section>
      <section className="ih-buybar" aria-label="Purchase context">
        <div className="ih-buybar-inner">
          <div className="ih-buy-copy"><span className="ih-price">$18.40/kg</span><span className="ih-buy-note">Indicative trade price · packed to order</span></div>
          <div className="ih-pack-picker" aria-label="Select pack size">{packs.map((item) => <button key={item} className={pack === item ? "selected" : ""} onClick={() => setPack(item)}>{item}</button>)}</div>
          <button className="ih-contact">Ask about an order <ArrowRight size={15} /></button>
        </div>
      </section>
      <div className="ih-layout">
        <main className="ih-main">
          <section className="ih-section" id="fit">
            <h2>Make the paddock call first.</h2>
            <p className="ih-section-intro">The useful starting point for SouWest is a fertile, workable paddock with at least 500 mm seasonal rainfall or reliable irrigation. Use these signals to decide whether the mix belongs in the rotation.</p>
            <div className="ih-decision-grid">
              <div className="ih-decision"><small>Rainfall</small><strong>500 mm+<br />or irrigated</strong></div>
              <div className="ih-decision"><small>Soil range</small><strong>LS · S · L · H</strong></div>
              <div className="ih-decision"><small>Pasture rate</small><strong>18–25 kg/ha</strong></div>
              <div className="ih-decision"><small>Sowing depth</small><strong>10–15 mm</strong></div>
            </div>
          </section>
          <section className="ih-section" id="identity">
            <h2>Botanical identity</h2>
            <div className="ih-field-grid">
              <Field label="Record type">Mix</Field><Field label="Botanical identity">Lolium perenne · Trifolium subterraneum · Medicago sativa blend</Field>
              <Field label="Also known as">Southwest Pasture Blend, SW winter pasture</Field><Field label="Category / classification">Pasture mix · cool-season grazing</Field>
              <Field label="Persistency">Short-term (1–2 years), with annual legume component</Field><Field label="Origin">Formulated in Western Australia for southern districts</Field>
            </div>
          </section>
          <section className="ih-section" id="agronomy">
            <h2>Agronomy at a glance</h2>
            <table className="ih-table"><tbody>
              <tr><th>Soil fit</th><td>Light sandy loams (LS) through sands (S), loams (L) and heavier soils (H) where drainage is sound.</td></tr>
              <tr><th>pH target</th><td>pH (CaCl₂) 5.2 and above. Lime where soil test results call for correction.</td></tr>
              <tr><th>Sowing rates</th><td>Pasture: 18–25 kg/ha. In a mix: 12–18 kg/ha where companion species carry more of the sward.</td></tr>
              <tr><th>Sowing depth</th><td>10–15 mm. Place into a firm, moist seedbed and avoid burying the smaller-seeded legumes.</td></tr>
              <tr><th>Flowering / maturity</th><td>Mid to late flowering window; approximately 140 days to flowering from a Perth autumn sowing.</td></tr>
              <tr><th>Winter activity</th><td>Rating 7. Strong winter production with a useful spring finish.</td></tr>
            </tbody></table>
          </section>
          <section className="ih-section" id="management">
            <h2>Management details</h2>
            <div className="ih-field-grid">
              <Field label="Tolerance qualifiers">Moderate drought tolerance; mild waterlogging tolerance; moderate low-pH tolerance; low salinity tolerance.</Field>
              <Field label="Inoculant group">G/S — use the nominated rhizobia group for the legume component.</Field>
              <Field label="Seed treatment">Lime coated. Confirm treatment status on pack before sowing.</Field>
              <Field label="Grazing management">Graze once established. Allow recovery after heavy grazing and avoid grazing wet paddocks to protect plant crowns.</Field>
            </div>
          </section>
          <section className="ih-section" id="use">
            <h2>Where it earns its place</h2>
            <div className="ih-tags">{tags.map((tag) => <span className="ih-tag" key={tag}>{tag}</span>)}</div>
            <div className="ih-field-grid" style={{ marginTop: 14 }}><Field label="Companion species">Can be paired with oats, forage brassica, vetch and additional sub clover where the paddock plan calls for it.</Field><Field label="Performance notes">Fast establishment, strong early winter feed and a balanced grass-legume base for flexible grazing.</Field><Field label="Disease / pest resistance">No specific resistance claim. Monitor for red-legged earth mite and leaf disease under conducive conditions.</Field><Field label="End use">Grazing, hay, silage, stockfeed and short-term pasture renovation.</Field></div>
          </section>
          <section className="ih-section" id="components">
            <h2>Mix components</h2>
            <p className="ih-section-intro">The formulation is designed as a balanced starting point, with room for agronomist-led adjustment by season and paddock.</p>
            <div className="ih-component"><strong>Perennial ryegrass</strong><span>45%</span><span>Primary winter feed and recovery.</span></div>
            <div className="ih-component"><strong>Sub clover blend</strong><span>30%</span><span>Legume contribution and spring quality.</span></div>
            <div className="ih-component"><strong>Annual ryegrass</strong><span>15%</span><span>Quick establishment and early bulk.</span></div>
            <div className="ih-component"><strong>Lucerne</strong><span>10%</span><span>Protein and summer persistence on suitable ground.</span></div>
          </section>
          <section className="ih-section" id="commercial">
            <h2>Commercial &amp; legal record</h2>
            <div className="ih-field-grid">
              <Field label="Stock code">SWM-026</Field><Field label="Formulation year">2026</Field><Field label="Distributed by">IH Seeds</Field><Field label="Supplier status">IH Seeds formulated product</Field>
              <Field label="Certification">ASF Code of Practice · Certified Quality Assured Seed</Field><Field label="PBR / licence">Not PBR protected. No licence restriction recorded.</Field>
            </div>
            <div className="ih-footer-note">Seed performance varies with paddock preparation, seasonal conditions and management. Always check the current label, analysis and treatment declaration supplied with your pack.</div>
          </section>
          <section className="ih-section" id="photos">
            <h2>From the field</h2>
            <div className="ih-gallery"><div className="ih-photo"><label>Established sward · autumn</label></div><div className="ih-photo"><label>Legume balance</label></div><div className="ih-photo"><label>Grazing recovery</label></div></div>
          </section>
          <section className="ih-section" id="related">
            <h2>Related products</h2>
            <div className="ih-related"><div className="ih-related-card"><b>Great Southern Ryegrass</b><span>High winter activity for fertile loams · 10 kg</span></div><div className="ih-related-card"><b>Sub Clover Select</b><span>Reliable legume partner across southern soils · 5 kg</span></div><div className="ih-related-card"><b>Westland Cover Mix</b><span>Flexible cover and grazing option · 20 kg</span></div></div>
          </section>
        </main>
        <aside className="ih-anchor" aria-label="On this page"><span>ON THIS PAGE</span><a href="#fit">Paddock fit</a><a href="#identity">Botanical identity</a><a href="#agronomy">Agronomy</a><a href="#management">Management</a><a href="#use">End use</a><a href="#components">Mix components</a><a href="#commercial">Commercial record</a><a href="#photos">Field photos</a><a href="#related">Related products</a></aside>
      </div>
    </div>
  );
}