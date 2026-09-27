import { useGetAdminSiteSettings, resolveSocialImage } from "@workspace/api-client-react";
import { socialSourceLabel } from "../social-share";

type SiteSocial = { socialImageSrc?: string | null; socialImageAssetId?: string | null };

/** Effective share image for a product or article, using the shared resolver. */
export function SocialImagePreview({ override, hero, kind }: { override?: string; hero?: string; kind: "product" | "article" }) {
  const { data } = useGetAdminSiteSettings();
  const homepage = (data?.homepage ?? {}) as SiteSocial;
  const resolved = resolveSocialImage({
    override: override?.trim() || undefined,
    hero: hero?.trim() || undefined,
    siteImage: homepage.socialImageSrc?.trim() || undefined,
    siteAssetId: homepage.socialImageAssetId?.trim() || undefined,
  });
  return (
    <div className="admin-social-effective" aria-live="polite">
      <div className="admin-social-thumb" role="img" aria-label="Effective social sharing image" style={{ backgroundImage: `url(${resolved.src})` }} />
      <div>
        <span className="admin-label-title">Image used when shared</span>
        <strong data-testid="social-image-source">{socialSourceLabel(resolved.source, kind)}</strong>
        <span className="admin-field-hint">
          {resolved.source === "override"
            ? "Clear the custom image to fall back automatically."
            : "Order: custom image, then " + (kind === "article" ? "hero image" : "first product photo") + ", then the Site settings image, then the IH Seeds default."}
        </span>
      </div>
    </div>
  );
}
