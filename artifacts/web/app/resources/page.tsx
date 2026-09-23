import type { Metadata } from "next";
import { getArticles, getProducts } from "../../lib/catalogue";
import { loadSiteSettings } from "../../lib/site-settings";
import { ResourcesContent } from "./ResourcesContent";

export const metadata: Metadata = {
  title: "Pasture Seed Resources and Tech Sheets | IH Seeds",
  description: "Read IH Seeds pasture advice and browse downloadable technical information for current seed varieties and mixes.",
  alternates: { canonical: "/resources" },
};

export default async function Resources({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [articles, products, settings, query] = await Promise.all([
    getArticles(),
    getProducts(),
    loadSiteSettings(),
    searchParams,
  ]);
  const tab = query.tab === "sheets" ? "sheets" : "articles";

  return (
    <ResourcesContent
      articles={articles}
      products={products}
      seedGuide={settings.seedGuide}
      initialTab={tab}
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