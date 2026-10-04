export type CompanyContact = {
  legalName: string;
  tradingName: string;
  phone: string;
  email: string;
  address: string;
  officeHours: string;
  abn: string;
  socialLinks?: string[];
};

export const DEFAULT_COMPANY: CompanyContact = {
  legalName: "Irwin Hunter & Co",
  tradingName: "IH Seeds",
  phone: "",
  email: "info@irwinhunter.com.au",
  address: "Unit 5, 75 Robinson Avenue, Belmont, WA 6104",
  officeHours: "Monday to Friday, 8am–5pm AWST",
  abn: "",
};

export function companyMapsUrl(address: string) {
  const query = address.trim();
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : "";
}

export function companyTelHref(phone: string) {
  const trimmed = phone.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("+")) return `tel:${trimmed.replace(/[^\d+]/g, "")}`;
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0") && digits.length >= 8) return `tel:+61${digits.slice(1)}`;
  if (digits.startsWith("61")) return `tel:+${digits}`;
  return `tel:${digits}`;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

function dayIndex(value: string) {
  const prefix = value.trim().slice(0, 3).toLowerCase();
  return DAYS.findIndex((day) => day.slice(0, 3).toLowerCase() === prefix);
}

function clock(hour: string, minute: string | undefined, meridiem: string) {
  let h = Number(hour) % 12;
  if (meridiem.toLowerCase() === "pm") h += 12;
  return `${String(h).padStart(2, "0")}:${minute ?? "00"}`;
}

/** "Monday to Friday, 8am–5pm AWST" -> a schema.org OpeningHoursSpecification, or null when it cannot be read safely. */
export function openingHoursSpecification(officeHours: string) {
  const match = officeHours.match(
    /([A-Za-z]{3,})\w*\s*(?:to|-|–|—)\s*([A-Za-z]{3,})\w*,?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*(?:to|-|–|—)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i,
  );
  if (!match) return null;
  const first = dayIndex(match[1]);
  const last = dayIndex(match[2]);
  if (first < 0 || last < first) return null;
  const opens = clock(match[3], match[4], match[5]);
  const closes = clock(match[6], match[7], match[8]);
  if (opens >= closes) return null;
  return {
    "@type": "OpeningHoursSpecification",
    dayOfWeek: DAYS.slice(first, last + 1),
    opens,
    closes,
  };
}

/** "Unit 5, 75 Robinson Avenue, Belmont, WA 6104" -> structured PostalAddress; falls back to the whole string. */
export function postalAddress(address: string) {
  const trimmed = address.trim();
  const match = trimmed.match(/^(.*),\s*([^,]+),\s*([A-Z]{2,3})\s+(\d{4})$/);
  if (!match) return { "@type": "PostalAddress", streetAddress: trimmed, addressCountry: "AU" };
  return {
    "@type": "PostalAddress",
    streetAddress: match[1].trim(),
    addressLocality: match[2].trim(),
    addressRegion: match[3],
    postalCode: match[4],
    addressCountry: "AU",
  };
}

const LOGO_PATH = "/ih-seeds-logo.png";

/** Public profile URLs for `sameAs`: https only, no duplicates. */
export function socialProfileUrls(company: Pick<CompanyContact, "socialLinks">) {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const raw of company.socialLinks ?? []) {
    try {
      const url = new URL(raw.trim());
      if (url.protocol !== "https:") continue;
      const href = url.toString();
      if (seen.has(href.toLowerCase())) continue;
      seen.add(href.toLowerCase());
      urls.push(href);
    } catch {
      // Ignore anything that is not a full URL.
    }
  }
  return urls;
}

export function organizationJsonLd(company: CompanyContact, siteUrl = "https://irwinhunter.com.au") {
  const graph: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${siteUrl}/#organization`,
    name: company.tradingName || company.legalName,
    url: siteUrl,
    logo: `${siteUrl}${LOGO_PATH}`,
  };
  if (company.legalName && company.legalName !== company.tradingName) {
    graph.alternateName = company.legalName;
  }
  if (company.email.trim()) graph.email = company.email.trim();
  if (company.phone.trim()) graph.telephone = company.phone.trim();
  if (company.address.trim()) graph.address = postalAddress(company.address);
  if (company.abn.trim()) graph.taxID = company.abn.trim();
  const sameAs = socialProfileUrls(company);
  if (sameAs.length) graph.sameAs = sameAs;
  return graph;
}

/** The physical office/business listing, linked to the Organization. */
export function localBusinessJsonLd(company: CompanyContact, siteUrl = "https://irwinhunter.com.au") {
  const graph: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${siteUrl}/#localbusiness`,
    name: company.tradingName || company.legalName,
    url: siteUrl,
    image: `${siteUrl}${LOGO_PATH}`,
    logo: `${siteUrl}${LOGO_PATH}`,
    description: "Western Australian pasture seed merchant: pasture seed, mixes and advice for WA farms, sold through rural stores.",
    parentOrganization: { "@id": `${siteUrl}/#organization` },
    areaServed: { "@type": "AdministrativeArea", name: "Western Australia", containedInPlace: { "@type": "Country", name: "Australia" } },
  };
  if (company.legalName && company.legalName !== company.tradingName) graph.legalName = company.legalName;
  if (company.email.trim()) graph.email = company.email.trim();
  if (company.phone.trim()) graph.telephone = company.phone.trim();
  if (company.address.trim()) {
    graph.address = postalAddress(company.address);
    graph.hasMap = companyMapsUrl(company.address);
  }
  const hours = openingHoursSpecification(company.officeHours);
  if (hours) graph.openingHoursSpecification = hours;
  if (company.abn.trim()) graph.taxID = company.abn.trim();
  const sameAs = socialProfileUrls(company);
  if (sameAs.length) graph.sameAs = sameAs;
  return graph;
}

export function webSiteJsonLd(company: CompanyContact, siteUrl = "https://irwinhunter.com.au") {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${siteUrl}/#website`,
    url: siteUrl,
    name: company.tradingName || company.legalName,
    inLanguage: "en-AU",
    publisher: { "@id": `${siteUrl}/#organization` },
  };
}

/** One @graph for the whole site: Organization, LocalBusiness and WebSite, cross-linked by @id. */
export function siteJsonLd(company: CompanyContact, siteUrl = "https://irwinhunter.com.au") {
  const strip = ({ "@context": _context, ...node }: Record<string, unknown>) => node;
  return {
    "@context": "https://schema.org",
    "@graph": [
      strip(organizationJsonLd(company, siteUrl)),
      strip(localBusinessJsonLd(company, siteUrl)),
      strip(webSiteJsonLd(company, siteUrl)),
    ],
  };
}
