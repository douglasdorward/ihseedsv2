import assert from "node:assert/strict";
import test from "node:test";
import { companyMapsUrl, companyTelHref, DEFAULT_COMPANY, organizationJsonLd } from "./company.ts";

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
