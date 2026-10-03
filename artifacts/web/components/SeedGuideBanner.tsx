import { CoverImage } from "./CoverImage";
import type { PublicSiteSeedGuide } from "../lib/catalogue";
import { publicMediaSrc } from "../lib/site-settings";

const fallbackImage = "https://images.unsplash.com/photo-1499529112087-3cb3b73cec95?auto=format&fit=crop&w=900&q=80";

export function SeedGuideBanner({ seedGuide }: { seedGuide: PublicSiteSeedGuide }) {
  return (
    <section style={{ background: "var(--sage)" }}>
      <div className="page-wide" style={{ maxWidth: 1440, margin: "0 auto", padding: "96px 40px" }}>
        <div className="guide-banner">
          <CoverImage src={publicMediaSrc({ src: seedGuide.cardImageSrc, assetId: seedGuide.cardImageAssetId }, "card") || fallbackImage} alt="" sizes="(max-width: 900px) 100vw, 1360px" />
          <div className="guide-scrim" aria-hidden="true" />
          <div>
            <h2>{seedGuide.cardHeading}</h2>
            <a href={seedGuide.pdfPublicUrl} className="button button-light" style={{ display: "inline-block", textDecoration: "none" }} download>{seedGuide.cardButtonLabel}</a>
          </div>
        </div>
      </div>
    </section>
  );
}
