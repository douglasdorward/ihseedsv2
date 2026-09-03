import { useEffect, useMemo, useState, type FormEvent } from "react";

type Product = {
  id: number;
  name: string;
  price: string;
  packSize: string;
  status: string;
  note: string;
};

type EnquiryForm = {
  name: string;
  email: string;
  phone: string;
  topic: string;
  message: string;
};

const articleSeed = [
  { category: "Editorial", date: "27 October 2025", title: "Mix & Match Custom Pasture", excerpt: "The need for sustainable and productive pastures has never been greater in today’s farming landscape.", image: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1000&q=80" },
  { category: "Sowing & Timing", date: "12 September 2025", title: "Getting Your Autumn Sowing Window Right", excerpt: "Timing decides the season. Soil temperature, rainfall triggers and the sowing rates that hold up.", image: "https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=1000&q=80" },
  { category: "Feed Planning", date: "4 August 2025", title: "Feed Planning Through a Dry Finish", excerpt: "Practical steps for holding feed quality when the season shortens.", image: "https://images.unsplash.com/photo-1530507629858-e4977d30e9e0?auto=format&fit=crop&w=1000&q=80" },
  { category: "Regional Advice", date: "18 July 2025", title: "Choosing a Mix for Your Rainfall Zone", excerpt: "A practical starting point for matching pasture performance to the country you farm.", image: "https://images.unsplash.com/photo-1499529112087-3cb3b73cec95?auto=format&fit=crop&w=1000&q=80" },
];

const fallbackProducts: Product[] = [
  { id: 1, name: "SouWest™ Pasture Mix", price: "$25.00 per kg", packSize: "25 kg bag", status: "in-stock", note: "Blended to order, 500 mm+ zones" },
  { id: 2, name: "Maximix", price: "$25.00 per kg", packSize: "25 kg bag", status: "in-stock", note: "Versatile pasture mix for broad-acre sowing" },
  { id: 3, name: "Silahay™ Mix", price: "$25.00 per kg", packSize: "25 kg bag", status: "low", note: "Hay and silage, mid rainfall" },
  { id: 4, name: "Self Regeneration Pasture Mix", price: "$25.00 per kg", packSize: "25 kg bag", status: "in-stock", note: "Built for persistence and recovery" },
  { id: 5, name: "Ceres PG One50 Ryegrass", price: "$14.50 per kg", packSize: "25 kg bag", status: "in-stock", note: "Perennial, 600 mm+ zones" },
  { id: 6, name: "Margurita French Serradella", price: "$9.80 per kg", packSize: "25 kg bag", status: "low", note: "Reliable early-season legume" },
  { id: 7, name: "SARDI Seven Lucerne", price: "$18.00 per kg", packSize: "25 kg bag", status: "in-stock", note: "High quality feed for rotational systems" },
  { id: 8, name: "Dalkeith Subterranean Clover", price: "$11.20 per kg", packSize: "25 kg bag", status: "very-low", note: "Early season, 325–450 mm" },
];

const imageOptions = [
  "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1530507629858-e4977d30e9e0?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1499529112087-3cb3b73cec95?auto=format&fit=crop&w=900&q=80",
];

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function Icon({ name, size = 22 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (name === "menu") return <svg {...common}><path d="M4 6h16M4 12h16M4 18h16" /></svg>;
  if (name === "close") return <svg {...common}><path d="m6 6 12 12M18 6 6 18" /></svg>;
  if (name === "search") return <svg {...common}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>;
  if (name === "user") return <svg {...common}><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.9-3.2 3.2-4.8 7-4.8s6.1 1.6 7 4.8" /></svg>;
  if (name === "arrow-left") return <svg {...common}><path d="M19 12H5m6-6-6 6 6 6" /></svg>;
  if (name === "arrow-right") return <svg {...common}><path d="M5 12h14m-6-6 6 6-6 6" /></svg>;
  if (name === "map-pin") return <svg {...common}><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>;
  if (name === "sprout") return <svg {...common}><path d="M12 21V10M12 14c-4.5 0-6.5-2.5-6.5-6.5C9.5 7.5 12 9.5 12 14Zm0-4c0-4.1 2.2-6.2 6.5-6.2 0 3.8-2.1 6.2-6.5 6.2Z" /></svg>;
  return <svg {...common}><path d="M12 20V11m0 0c-3.4 0-5.5-1.8-5.5-5.5C10.3 5.5 12 7.4 12 11Zm0 0c3.4 0 5.5-1.8 5.5-5.5C13.7 5.5 12 7.4 12 11Z" /></svg>;
}

function Logo({ inverse = false }: { inverse?: boolean }) {
  return <button className={`logo ${inverse ? "logo-inverse" : ""}`} onClick={() => scrollToId("top")} data-testid="button-logo" aria-label="Back to top">
    <span className="logo-mark">IH</span><span>Seeds</span><small>Irwin Hunter &amp; Co</small>
  </button>;
}

function StatusPill({ status }: { status: string }) {
  const labels: Record<string, string> = { "in-stock": "In stock", low: "Low stock", "very-low": "Very low", unavailable: "Unavailable" };
  return <span className={`status-pill status-${status}`} data-testid={`status-product-${status}`}><i />{labels[status] ?? status}</span>;
}

function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [productPage, setProductPage] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [showArticles, setShowArticles] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitState, setSubmitState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [form, setForm] = useState<EnquiryForm>({ name: "", email: "", phone: "", topic: "General advice", message: "" });

  useEffect(() => {
    fetch("/api/products")
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Catalogue unavailable")))
      .then((data: Product[]) => setProducts(data))
      .catch(() => setProducts(fallbackProducts))
      .finally(() => setLoading(false));
  }, []);

  const filteredProducts = useMemo(() => products.filter((product) => `${product.name} ${product.note}`.toLowerCase().includes(query.toLowerCase())), [products, query]);
  const pages = Math.max(1, Math.ceil(filteredProducts.length / 4));
  const visibleProducts = filteredProducts.slice((productPage % pages) * 4, (productPage % pages) * 4 + 4);

  const navigate = (id: string) => {
    setMenuOpen(false);
    scrollToId(id);
  };

  const submitEnquiry = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitState("sending");
    try {
      const response = await fetch("/api/enquiries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!response.ok) throw new Error("Unable to send enquiry");
      setSubmitState("sent");
      setForm({ name: "", email: "", phone: "", topic: "General advice", message: "" });
    } catch {
      setSubmitState("error");
    }
  };

  const downloadGuide = () => {
    const anchor = document.createElement("a");
    anchor.href = "/IH-Seeds-2026-Pasture-Seed-Guide.pdf";
    anchor.download = "IH-Seeds-2026-Pasture-Seed-Guide.pdf";
    anchor.click();
  };

  return <div id="top" className="site-shell">
    <header className="site-header">
      <Logo />
      <nav className={`desktop-nav ${menuOpen ? "mobile-nav-open" : ""}`} aria-label="Main navigation">
        <button className="nav-link active" onClick={() => navigate("products")} data-testid="link-products">Products</button>
        <button className="nav-link" onClick={() => navigate("guide")} data-testid="link-guide">Seed Guide 2026</button>
        <button className="nav-link" onClick={() => navigate("availability")} data-testid="link-availability">Seed Availability</button>
        <button className="nav-link" onClick={() => navigate("resources")} data-testid="link-resources">Resources</button>
        <button className="nav-link" onClick={() => navigate("about")} data-testid="link-about">About</button>
        <button className="button button-accent nav-cta" onClick={() => navigate("contact")} data-testid="button-get-in-touch">Get in Touch</button>
        <button className="utility-button" onClick={() => setSearchOpen((open) => !open)} data-testid="button-search" aria-label="Search catalogue"><Icon name="search" size={18} /></button>
        <button className="utility-button" onClick={() => navigate("contact")} data-testid="button-account" aria-label="Contact IH Seeds"><Icon name="user" size={18} /></button>
      </nav>
      <button className="mobile-menu-button" onClick={() => setMenuOpen((open) => !open)} data-testid="button-mobile-menu" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen}><Icon name={menuOpen ? "close" : "menu"} size={26} /></button>
    </header>

    {searchOpen && <div className="search-bar"><label htmlFor="catalogue-search">Search the catalogue</label><input id="catalogue-search" value={query} onChange={(event) => { setQuery(event.target.value); setProductPage(0); }} placeholder="Try ryegrass, lucerne or pasture mix" autoFocus data-testid="input-catalogue-search" /><button onClick={() => { setSearchOpen(false); navigate("products"); }} data-testid="button-search-results">View results</button></div>}

    <main>
      <section className="hero-wrap">
        <div className="hero" style={{ backgroundImage: `linear-gradient(90deg, rgba(29,40,28,.98) 0%, rgba(29,40,28,.84) 47%, rgba(29,40,28,.42) 100%), url(${imageOptions[0]})` }}>
          <div className="hero-copy">
            <h1><span>Western Australia's</span><strong>Pasture Seed Specialists</strong></h1>
            <p>Independently owned since 1966. We source, test and blend improved pasture seed for every region of the state — from Esperance to Derby.</p>
            <div className="hero-actions"><button className="button button-primary" onClick={() => navigate("contact")} data-testid="button-advice">Advice</button><button className="button button-light" onClick={() => navigate("products")} data-testid="button-browse-catalogue">Browse the catalogue</button></div>
          </div>
        </div>
      </section>

      <section className="pillars" aria-label="Why IH Seeds">
        <div className="three-column">
          <div className="pillar"><Icon name="map-pin" size={27} /><h3>Regional expertise</h3><p>Local conditions, understood and applied. Sixty years of sowing across every WA rainfall zone.</p></div>
          <div className="pillar"><Icon name="sprout" size={27} /><h3>Proven performance</h3><p>Varieties and mixes proven over generations across Australia, with trial data behind them.</p></div>
          <div className="pillar"><Icon name="handshake" size={27} /><h3>Partnership</h3><p>Confidence before the order. Support after it — through your local rural reseller.</p></div>
        </div>
      </section>

      <section id="products" className="section section-subtle">
        <div className="content-width">
          <div className="section-heading"><h2><span>Best</span> Sellers</h2><div className="carousel-actions"><button className="icon-button" onClick={() => setProductPage((page) => page - 1)} disabled={pages < 2} data-testid="button-products-previous" aria-label="Previous products"><Icon name="arrow-left" /></button><button className="icon-button" onClick={() => setProductPage((page) => page + 1)} disabled={pages < 2} data-testid="button-products-next" aria-label="Next products"><Icon name="arrow-right" /></button></div></div>
          {loading ? <div className="loading-state" data-testid="status-products-loading">Loading the catalogue…</div> : visibleProducts.length === 0 ? <div className="empty-state" data-testid="status-products-empty">No products match “{query}”.</div> : <div className="product-grid">{visibleProducts.map((product, index) => <article className="product-card" key={product.id} data-testid={`card-product-${product.id}`}><div className="product-image" style={{ backgroundImage: `linear-gradient(180deg, transparent, rgba(29,40,28,.72)), url(${imageOptions[index % imageOptions.length]})` }}><StatusPill status={product.status} /></div><div className="product-details"><h3>{product.name}</h3><p>{product.packSize}</p><strong>{product.price}</strong></div></article>)}</div>}
        </div>
      </section>

      <section id="about" className="section about-section"><div className="feature-panel"><div className="feature-image" style={{ backgroundImage: `linear-gradient(90deg, rgba(12,88,60,.12), rgba(12,88,60,.02)), url(${imageOptions[2]})` }} /><div className="feature-copy"><h2><span>About</span> Us</h2><p>Irwin Hunter &amp; Co has been Western Australian owned and operated since 1966. We supply true to type seed from credible growers, blended into mixes that suit the paddock they are going into. Our long history across the state means we know which varieties perform in every region.</p><button className="button button-outline" onClick={() => navigate("contact")} data-testid="button-learn-about">Learn more about IH Seeds</button></div></div></section>

      <section id="availability" className="section section-subtle"><div className="content-width"><div className="section-heading"><h2><span>Seed</span> Availability</h2><button className="button button-outline" onClick={() => navigate("contact")} data-testid="button-availability-help">Ask about availability</button></div><div className="availability-table">{products.slice(0, 5).map((product) => <div className="availability-row" key={product.id} data-testid={`row-availability-${product.id}`}><strong>{product.name}</strong><span>{product.note}</span><StatusPill status={product.status} /></div>)}<p className="table-note">Availability is updated weekly. Your reseller may hold additional stock.</p></div></div></section>

      <section id="resources" className="section resources-section"><div className="content-width"><div className="section-heading centered"><h2><span>Tips &amp;</span> Advice</h2></div><div className="article-grid">{articleSeed.slice(0, showArticles ? 4 : 3).map((article, index) => <article className="article-card" key={article.title} data-testid={`card-article-${index}`}><div className="article-image" style={{ backgroundImage: `url(${article.image})` }} /><div className="article-copy"><small>{article.category} · {article.date}</small><h3>{article.title}</h3><p>{article.excerpt}</p><button className="text-link" onClick={() => navigate("contact")} data-testid={`button-article-enquiry-${index}`}>Ask for advice <span>↗</span></button></div></article>)}</div><div className="centered-action"><button className="button button-outline" onClick={() => setShowArticles((show) => !show)} data-testid="button-view-more">{showArticles ? "Show Less" : "View More"}</button></div></div></section>

      <section id="guide" className="section guide-section"><div className="guide-banner" style={{ backgroundImage: `linear-gradient(90deg, rgba(29,40,28,.92), rgba(29,40,28,.44)), url(${imageOptions[1]})` }}><div><h2>Regional advice, sowing rates and seasonal planning in one place.</h2><button className="button button-light" onClick={downloadGuide} data-testid="button-download-guide">Download the 2026 Pasture Seed Guide (PDF)</button></div></div></section>

      <section id="contact" className="section contact-section"><div className="content-width contact-layout"><div className="contact-intro"><h2><span>Talk to</span> our team</h2><p>Tell us about your country and we’ll help you find a mix and sowing approach that fits the season.</p><p className="contact-detail">Western Australia · (08) 9479 1234<br />Advice before the order. Support after it.</p></div><form className="enquiry-form" onSubmit={submitEnquiry}><div className="form-row"><label>Name<input required minLength={2} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} data-testid="input-enquiry-name" /></label><label>Email<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} data-testid="input-enquiry-email" /></label></div><div className="form-row"><label>Phone <small>(optional)</small><input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} data-testid="input-enquiry-phone" /></label><label>What can we help with?<select value={form.topic} onChange={(event) => setForm({ ...form, topic: event.target.value })} data-testid="select-enquiry-topic"><option>General advice</option><option>Product availability</option><option>Finding a reseller</option><option>Custom pasture mix</option></select></label></div><label>Message<textarea required minLength={10} rows={4} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} placeholder="Tell us your region, rainfall zone and what you’re sowing." data-testid="input-enquiry-message" /></label><button className="button button-primary" type="submit" disabled={submitState === "sending"} data-testid="button-submit-enquiry">{submitState === "sending" ? "Sending…" : "Send enquiry"}</button>{submitState === "sent" && <p className="form-status success" data-testid="status-enquiry-sent">Thanks — your enquiry is with the IH Seeds team.</p>}{submitState === "error" && <p className="form-status error" data-testid="status-enquiry-error">We couldn’t send that just now. Please try again.</p>}</form></div></section>
    </main>

    <footer className="site-footer"><div className="footer-top"><Logo inverse /><p>The pasture seed and mixes specialists of Western Australia.</p><div className="footer-columns"><div><h4>Products</h4><button onClick={() => navigate("products")} data-testid="footer-products">Specialty Mixes</button><button onClick={() => navigate("products")} data-testid="footer-ryegrass">Ryegrass</button><button onClick={() => navigate("products")} data-testid="footer-clovers">Clovers</button></div><div><h4>Resources</h4><button onClick={() => navigate("resources")} data-testid="footer-resources">Tips &amp; Advice</button><button onClick={() => navigate("guide")} data-testid="footer-guide">Pasture Seed Guide</button><button onClick={() => navigate("availability")} data-testid="footer-availability">Seed Availability</button></div><div><h4>Company</h4><button onClick={() => navigate("about")} data-testid="footer-story">Our Story</button><button onClick={() => navigate("contact")} data-testid="footer-contact">Contact</button></div></div></div><div className="footer-bottom">© 2026 Irwin Hunter &amp; Co · Australian Seed Federation member</div></footer>
  </div>;
}

export default App;