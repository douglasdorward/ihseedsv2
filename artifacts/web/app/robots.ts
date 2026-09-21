import type { MetadataRoute } from "next";
import { absoluteSiteUrl, publicSiteUrl } from "../lib/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/admin/", "/api", "/api/", "/internal", "/internal/"],
    },
    sitemap: absoluteSiteUrl("/sitemap.xml"),
    host: publicSiteUrl.origin,
  };
}
