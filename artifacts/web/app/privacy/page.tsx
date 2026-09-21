import type { Metadata } from "next";
import Link from "next/link";
import { DEFAULT_COMPANY } from "../../lib/company";
import { FALLBACK_SITE_SETTINGS, loadSiteSettings } from "../../lib/site-settings";

export const metadata: Metadata = {
  title: "Privacy Policy | IH Seeds",
  description: "How IH Seeds collects and uses personal information from website enquiries and office contact.",
  alternates: { canonical: "/privacy" },
};

export default async function PrivacyPage() {
  const settings = await loadSiteSettings().catch(() => FALLBACK_SITE_SETTINGS);
  const company = settings.company ?? DEFAULT_COMPANY;

  return (
    <article className="legal-page">
      <header className="legal-hero">
        <p className="eyebrow">Legal</p>
        <h1>Privacy <strong>Policy</strong></h1>
        <p>This is a first-draft policy for the IH Seeds public website. It is not a substitute for legal review.</p>
      </header>
      <div className="legal-body">
        <p>
          {company.tradingName} ({company.legalName}) operates this website from {company.address}.
          We supply pasture seed through rural resellers. This site does not take online payments or create customer accounts.
        </p>
        <h2>What we collect</h2>
        <p>
          If you send an enquiry, we collect the name, email, phone number, topic and message you submit,
          plus any paddock details you choose to add (location, soil, rainfall and land size).
          Server logs may also record a technical address, browser type and the pages requested.
        </p>
        <h2>How we use it</h2>
        <p>
          We use enquiry details to reply to your question, to help with variety or mix advice, and to point you to a reseller.
          We do not sell personal information. We do not run advertising cookies on this site.
        </p>
        <h2>Who we share it with</h2>
        <p>
          An enquiry may be seen by the IH Seeds office team and, where needed, by the reseller who would supply the seed.
          Hosting and email providers that run this website may process the same information to deliver the service.
        </p>
        <h2>How long we keep it</h2>
        <p>
          Enquiry records are kept for as long as we need them to complete the request and keep a business record of advice given.
          You can ask us to correct or delete your details where the law allows.
        </p>
        <h2>Contact</h2>
        <p>
          Privacy questions can be sent through the <Link href="/contact">contact form</Link>
          {company.email ? <> or emailed to <a href={`mailto:${company.email}`}>{company.email}</a></> : null}.
        </p>
      </div>
    </article>
  );
}
