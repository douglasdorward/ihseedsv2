import type { Metadata } from "next";
import { Footer } from "../components/Footer";
import { Header } from "../components/Header";
import { getCategories } from "../lib/catalogue";
import { featuredNavCategories } from "../lib/catalogue-paths";
import { DEFAULT_COMPANY, organizationJsonLd } from "../lib/company";
import { FALLBACK_SITE_SETTINGS, loadSiteSettings } from "../lib/site-settings";
import { absoluteSiteUrl, publicSiteUrl } from "../lib/site-url";
import "./styles.css";

export const metadata: Metadata = {
  metadataBase: publicSiteUrl,
  title: "IH Seeds",
  description: "Western Australia's pasture seed specialists.",
};

export default async function RootLayout({ children }: { children: any }) {
  const [categories, settings] = await Promise.all([
    getCategories().catch(() => []),
    loadSiteSettings().catch(() => FALLBACK_SITE_SETTINGS),
  ]);
  const productCategories = featuredNavCategories(categories);
  const company = settings.company ?? DEFAULT_COMPANY;

  return (
    <html lang="en">
      <head>
        <link rel="describedby" href={absoluteSiteUrl("/llms.txt")} />
      </head>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd(company, publicSiteUrl.origin)).replace(/</g, "\\u003c") }}
        />
        <div className="site-shell">
          <Header productCategories={productCategories} seedGuideTitle={settings.seedGuide.navTitle} />
          <main>{children}</main>
          <Footer company={company} />
        </div>
      </body>
    </html>
  );
}