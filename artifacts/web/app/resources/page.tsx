import type { Metadata } from "next";
import { getArticles, getCategories, getProducts } from "../../lib/catalogue";
import { loadSiteSettings } from "../../lib/site-settings";
import { ResourcesContent } from "./ResourcesContent";

export const metadata: Metadata = {
  title: "Pasture Seed Resources and Tech Sheets | IH Seeds",
  description: "Read IH Seeds pasture advice and browse downloadable technical information for current seed varieties and mixes.",
};

export default async function Resources() {
  const [articles, products, categories, settings] = await Promise.all([
    getArticles(),
    getProducts(),
    getCategories(),
    loadSiteSettings(),
  ]);

  return (
    <ResourcesContent
      articles={articles}
      products={products}
      categories={categories}
      seedGuide={settings.seedGuide}
      intro={
        <div className="page-content resource-intro" style={{ maxWidth: 1180, margin: "0 auto", padding: "64px 40px 40px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--green)" }}>Resources</div>
          <h1 style={{ margin: 0, fontSize: 48, lineHeight: 1.2, fontWeight: 300, color: "var(--green)" }}>Advice, guides and <span style={{ fontWeight: 700 }}>tech sheets</span></h1>
          <p style={{ margin: 0, fontSize: 18, lineHeight: 1.6, color: "var(--black-green)", maxWidth: "64ch" }}>Everything we publish on sowing, feed planning and seasonal timing, plus a downloadable tech sheet for every mix and variety we stock.</p>
        </div>
      }
    />
  );
}