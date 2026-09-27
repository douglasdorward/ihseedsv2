import type { Metadata } from "next";
import { resolveSocialImage } from "../../../lib/api-client-react/src/social-sharing";
import { loadSiteSettings } from "./site-settings";
import { absoluteSiteUrl } from "./site-url";

type SocialOptions = {
  override?: string | null;
  hero?: string | null;
  siteImage?: string | null;
  siteAssetId?: string | null;
  socialTitle?: string;
  socialDescription?: string;
  type?: "article" | "website";
  alt?: string;
};

/** Supply every nested field on each page: Next.js replaces, rather than merges, nested metadata. */
export function socialMetadata(title: string, description: string, path: string, options: SocialOptions = {}): Pick<Metadata, "openGraph" | "twitter"> {
  const image = resolveSocialImage(options);
  const imageUrl = absoluteSiteUrl(image.src);
  const socialTitle = options.socialTitle || title;
  const socialDescription = options.socialDescription || description;
  return {
    openGraph: {
      type: options.type || "website",
      url: absoluteSiteUrl(path),
      title: socialTitle,
      description: socialDescription,
      images: [{ url: imageUrl, alt: options.alt || socialTitle }],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description: socialDescription,
      images: [imageUrl],
    },
  };
}

export async function siteSocialMetadata(title: string, description: string, path: string): Promise<Pick<Metadata, "openGraph" | "twitter">> {
  const settings = await loadSiteSettings();
  return socialMetadata(title, description, path, {
    siteImage: settings.homepage.socialImageSrc,
    siteAssetId: settings.homepage.socialImageAssetId,
  });
}