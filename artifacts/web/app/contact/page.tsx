import type { Metadata } from "next";
import { getResellers } from "../../lib/catalogue";
import { DEFAULT_COMPANY } from "../../lib/company";
import { pageSearchParams, selectorEnquiryPrefill } from "../../lib/pasture-selector";
import { FALLBACK_SITE_SETTINGS, loadSiteSettings } from "../../lib/site-settings";
import { ContactPage } from "./ContactPage";
import { siteSocialMetadata } from "../../lib/social-metadata";

const metadata: Metadata = {
  title: "Contact IH Seeds | Pasture Seed Advice",
  description: "Contact IH Seeds for pasture seed advice, sowing rates, availability, pricing and help finding a rural reseller in Western Australia.",
  alternates: { canonical: "/contact" },
};

export async function generateMetadata(): Promise<Metadata> {
  return { ...metadata, ...await siteSocialMetadata(metadata.title as string, metadata.description as string, "/contact") };
}

export default async function Contact({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [resellers, settings, params] = await Promise.all([
    getResellers().catch(() => []),
    loadSiteSettings().catch(() => FALLBACK_SITE_SETTINGS),
    searchParams.then(pageSearchParams),
  ]);
  return (
    <ContactPage
      resellers={resellers}
      company={settings.company ?? DEFAULT_COMPANY}
      enquiry={selectorEnquiryPrefill(params)}
    />
  );
}