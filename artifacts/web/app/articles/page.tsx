import type { Metadata } from "next";
import { getArticles } from "../../lib/catalogue";
import { loadSiteSettings } from "../../lib/site-settings";
import { siteSocialMetadata } from "../../lib/social-metadata";
import { ArticlesContent } from "./ArticlesContent";

const metadata: Metadata = {
  title: "Pasture Seed Articles | IH Seeds",
  description: "Read IH Seeds pasture advice on sowing, feed planning and seasonal timing.",
  alternates: { canonical: "/articles" },
};

export async function generateMetadata(): Promise<Metadata> {
  return { ...metadata, ...await siteSocialMetadata(metadata.title as string, metadata.description as string, "/articles") };
}

export default async function ArticlesPage() {
  const [articles, settings] = await Promise.all([
    getArticles(),
    loadSiteSettings(),
  ]);

  return (
    <ArticlesContent
      articles={articles}
      seedGuide={settings.seedGuide}
      intro={
        <div className="page-content resource-intro" style={{ maxWidth: 1180, margin: "0 auto", padding: "64px 40px 64px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--green)" }}>Articles</div>
          <h1 style={{ margin: 0, fontSize: 48, lineHeight: 1.2, fontWeight: 300, color: "var(--green)" }}>Advice and <span style={{ fontWeight: 700 }}>guides</span></h1>
          <p style={{ margin: 0, fontSize: 18, lineHeight: 1.6, color: "var(--black-green)", maxWidth: "64ch" }}>Everything we publish on sowing, feed planning and seasonal timing.</p>
        </div>
      }
    />
  );
}
