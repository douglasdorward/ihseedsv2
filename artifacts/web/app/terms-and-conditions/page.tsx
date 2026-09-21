import type { Metadata } from "next";
import Link from "next/link";
import { DEFAULT_COMPANY } from "../../lib/company";
import { FALLBACK_SITE_SETTINGS, loadSiteSettings } from "../../lib/site-settings";

export const metadata: Metadata = {
  title: "Terms and Conditions | IH Seeds",
  description: "Terms for using the IH Seeds website, catalogue information and agronomic advice.",
  alternates: { canonical: "/terms-and-conditions" },
};

export default async function TermsPage() {
  const settings = await loadSiteSettings().catch(() => FALLBACK_SITE_SETTINGS);
  const company = settings.company ?? DEFAULT_COMPANY;

  return (
    <article className="legal-page">
      <header className="legal-hero">
        <p className="eyebrow">Legal</p>
        <h1>Terms and <strong>Conditions</strong></h1>
        <p>This is a first-draft statement for the public website. It is not a substitute for legal review or a supply contract.</p>
      </header>
      <div className="legal-body">
        <p>
          These terms apply to use of the {company.tradingName} website operated by {company.legalName}.
          Seed is sold through rural resellers. This website is not an online shop and does not take orders or payment.
        </p>
        <h2>Catalogue information</h2>
        <p>
          Variety notes, sowing rates, rainfall bands, availability and prices are published as a guide.
          They can change with season, warehouse stock and reseller holdings. Confirm details with the office or your reseller before you order.
        </p>
        <h2>Advice</h2>
        <p>
          Agronomic comments on this site, including the Seed Guide, resources and enquiry replies, are general information for Western Australian conditions.
          They are not a site-specific recommendation. You remain responsible for choosing seed that suits your paddock, livestock and local advice.
        </p>
        <h2>Orders and supply</h2>
        <p>
          A purchase is made with your reseller, not through this website. Their terms, pricing and delivery arrangements apply to that sale.
          We may help you find a store, but we do not guarantee stock at a particular outlet.
        </p>
        <h2>Intellectual property</h2>
        <p>
          Website copy, photographs, the Seed Guide and the IH Seeds name remain the property of {company.legalName} or their licensors.
          You may share a page link. Do not copy the catalogue or guide for commercial use without permission.
        </p>
        <h2>Website use</h2>
        <p>
          Do not misuse the enquiry form, attempt to access administration tools, or rely on this site as the only record of availability.
          Content is provided without warranty as far as Australian law allows.
        </p>
        <h2>Contact</h2>
        <p>
          Questions about these terms can be sent through the <Link href="/contact">contact form</Link>
          {company.email ? <> or emailed to <a href={`mailto:${company.email}`}>{company.email}</a></> : null}.
        </p>
      </div>
    </article>
  );
}
