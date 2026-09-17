import assert from "node:assert/strict";
import test from "node:test";
import { formatSoilAndPh } from "./product-quick-facts";

const expectedNames = {
  LS: "Light sand",
  S: "Sand",
  L: "Loam",
  H: "Heavy",
};

for (const [code, name] of Object.entries(expectedNames)) {
  test(`expands ${code} to ${name}`, () => {
    assert.equal(formatSoilAndPh({
      soilRangeLightest: code,
      soilRangeHeaviest: code,
      soilPhMin: 5.5,
      soilPhScale: "CaCl₂",
    }), `Soil range: ${name} · pH 5.5+ (CaCl₂)`);
  });
}

test("formats distinct endpoints as a directional range", () => {
  assert.equal(formatSoilAndPh({
    soilRangeLightest: "S",
    soilRangeHeaviest: "H",
    soilPhMin: 5,
    soilPhScale: "CaCl₂",
  }), "Soil range: Sand to Heavy · pH 5+ (CaCl₂)");
});

test("omits output whenever a required soil or pH value is missing", () => {
  const complete = {
    soilRangeLightest: "S",
    soilRangeHeaviest: "H",
    soilPhMin: 5,
    soilPhScale: "CaCl₂",
  };
  for (const key of Object.keys(complete)) {
    assert.equal(formatSoilAndPh({ ...complete, [key]: key === "soilPhMin" ? null : "" }), "");
  }
});