import assert from "node:assert/strict";
import test from "node:test";
import {
  companyMapsUrl,
  companyTelHref,
  DEFAULT_COMPANY,
  localBusinessJsonLd,
  openingHoursSpecification,
  organizationJsonLd,
  postalAddress,
  siteJsonLd,
  socialProfileUrls,
  webSiteJsonLd,
} from "./company.ts";

test("companyTelHref keeps a blank phone unpublished", () => {
  assert.equal(companyTelHref(""), "");
  assert.equal(companyTelHref("   "), "");
});

test("companyTelHref converts Australian landlines to +61", () => {
  assert.equal(companyTelHref("(08) 9381 2345"), "tel:+61893812345");
  assert.equal(companyTelHref("+61 8 9381 2345"), "tel:+61893812345");
});

test("companyMapsUrl encodes the office address", () => {
  assert.equal(companyMapsUrl(""), "");
  assert.match(companyMapsUrl(DEFAULT_COMPANY.address), /Belmont/);
});

test("organizationJsonLd omits telephone when the phone is blank", () => {
  const graph = organizationJsonLd(DEFAULT_COMPANY);
  assert.equal(graph["@type"], "Organization");
  assert.equal(graph.name, "IH Seeds");
  assert.equal(graph.alternateName, "Irwin Hunter & Co");
  assert.equal("telephone" in graph, false);
  assert.equal(organizationJsonLd({ ...DEFAULT_COMPANY, phone: "(08) 9381 2345" }).telephone, "(08) 9381 2345");
});

test("postalAddress splits a standard Australian address and falls back to the raw string", () => {
  assert.deepEqual(postalAddress("Unit 5, 75 Robinson Avenue, Belmont, WA 6104"), {
    "@type": "PostalAddress",
    streetAddress: "Unit 5, 75 Robinson Avenue",
    addressLocality: "Belmont",
    addressRegion: "WA",
    postalCode: "6104",
    addressCountry: "AU",
  });
  assert.equal(postalAddress("Somewhere odd").streetAddress, "Somewhere odd");
});

test("openingHoursSpecification reads a weekday range and skips text it cannot parse", () => {
  assert.deepEqual(openingHoursSpecification("Monday to Friday, 8am–5pm AWST"), {
    "@type": "OpeningHoursSpecification",
    dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    opens: "08:00",
    closes: "17:00",
  });
  assert.equal(openingHoursSpecification("Mon-Sat 7:30am to 12:30pm")?.closes, "12:30");
  assert.equal(openingHoursSpecification("By appointment"), null);
  assert.equal(openingHoursSpecification("Friday to Monday 8am-5pm"), null);
});

test("local business and website nodes link to the organization and omit unknown facts", () => {
  const local = localBusinessJsonLd(DEFAULT_COMPANY, "https://example.com.au");
  assert.equal(local["@type"], "LocalBusiness");
  assert.deepEqual(local.parentOrganization, { "@id": "https://example.com.au/#organization" });
  assert.equal("telephone" in local, false);
  assert.equal("taxID" in local, false);
  assert.equal("geo" in local, false);
  assert.equal("priceRange" in local, false);
  assert.equal(webSiteJsonLd(DEFAULT_COMPANY, "https://example.com.au")["@type"], "WebSite");
});

test("siteJsonLd is a single graph without nested contexts", () => {
  const site = siteJsonLd(DEFAULT_COMPANY, "https://example.com.au");
  const nodes = site["@graph"] as Array<Record<string, unknown>>;
  assert.deepEqual(nodes.map((node) => node["@type"]), ["Organization", "LocalBusiness", "WebSite"]);
  assert.equal(nodes.some((node) => "@context" in node), false);
  assert.equal(nodes[0]["@id"], "https://example.com.au/#organization");
});

test("social profile links become sameAs on the organization and local business only when valid", () => {
  assert.equal("sameAs" in organizationJsonLd(DEFAULT_COMPANY), false);
  assert.equal("sameAs" in localBusinessJsonLd(DEFAULT_COMPANY), false);
  const company = {
    ...DEFAULT_COMPANY,
    socialLinks: ["https://www.facebook.com/ihseeds", "http://insecure.example.com/x", "not a url", "https://www.facebook.com/ihseeds", " https://www.linkedin.com/company/ih-seeds "],
  };
  const expected = ["https://www.facebook.com/ihseeds", "https://www.linkedin.com/company/ih-seeds"];
  assert.deepEqual(socialProfileUrls(company), expected);
  assert.deepEqual(organizationJsonLd(company).sameAs, expected);
  assert.deepEqual(localBusinessJsonLd(company).sameAs, expected);
});
