import type { MetadataRoute } from "next";
import { absoluteSiteUrl, publicSiteUrl } from "../lib/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      // Product photos and site images are served from these public API paths.
      allow: ["/", "/api/media/", "/api/site/"],
      disallow: ["/admin", "/admin/", "/api", "/api/", "/internal", "/internal/"],
    },
    sitemap: absoluteSiteUrl("/sitemap.xml"),
    host: publicSiteUrl.origin,
  };
}
