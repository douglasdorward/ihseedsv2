export type CompanyContact = {
  legalName: string;
  tradingName: string;
  phone: string;
  email: string;
  address: string;
  officeHours: string;
  abn: string;
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

export function organizationJsonLd(company: CompanyContact, siteUrl = "https://www.irwinhunter.com.au") {
  const graph: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: company.tradingName || company.legalName,
    url: siteUrl,
  };
  if (company.legalName && company.legalName !== company.tradingName) {
    graph.alternateName = company.legalName;
  }
  if (company.email.trim()) graph.email = company.email.trim();
  if (company.phone.trim()) graph.telephone = company.phone.trim();
  if (company.address.trim()) {
    graph.address = {
      "@type": "PostalAddress",
      streetAddress: company.address.trim(),
      addressCountry: "AU",
    };
  }
  if (company.abn.trim()) graph.taxID = company.abn.trim();
  return graph;
}
