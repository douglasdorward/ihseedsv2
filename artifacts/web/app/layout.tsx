import type { Metadata } from "next";
import { Raleway } from "next/font/google";
import { Footer } from "../components/Footer";
import { Header } from "../components/Header";
import { getCategories } from "../lib/catalogue";
import { featuredNavCategories } from "../lib/catalogue-paths";
import { DEFAULT_COMPANY, organizationJsonLd } from "../lib/company";
import { FALLBACK_SITE_SETTINGS, loadSiteSettings } from "../lib/site-settings";
import { absoluteSiteUrl, publicSiteUrl } from "../lib/site-url";
import { socialMetadata } from "../lib/social-metadata";
import "./styles.css";

const raleway = Raleway({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
  variable: "--font-raleway",
});

export const metadata: Metadata = {
  metadataBase: publicSiteUrl,
  title: "IH Seeds",
  description: "Western Australia's pasture seed specialists.",
  ...socialMetadata("IH Seeds", "Western Australia's pasture seed specialists.", "/"),
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default async function RootLayout({ children }: { children: any }) {
  const [categories, settings] = await Promise.all([
    getCategories().catch(() => []),
    loadSiteSettings().catch(() => FALLBACK_SITE_SETTINGS),
  ]);
  const productCategories = featuredNavCategories(categories);
  const company = settings.company ?? DEFAULT_COMPANY;

  return (
    <html lang="en" className={raleway.variable}>
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