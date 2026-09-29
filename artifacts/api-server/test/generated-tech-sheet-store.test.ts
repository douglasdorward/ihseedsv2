import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgres://localhost/unused";
const { canStoreGeneratedTechSheet } = await import("../src/lib/generated-tech-sheet.ts");

test("a loopback peer can store a tech sheet without a configured token", () => {
  const previous = process.env.TECH_SHEET_REFRESH_TOKEN;
  delete process.env.TECH_SHEET_REFRESH_TOKEN;
  try {
    assert.equal(canStoreGeneratedTechSheet("127.0.0.1", undefined), true);
    assert.equal(canStoreGeneratedTechSheet("::ffff:127.0.0.1", undefined), true);
    assert.equal(canStoreGeneratedTechSheet("10.0.0.8", undefined), false);
    assert.equal(canStoreGeneratedTechSheet("10.0.0.8", "local-tech-sheet-refresh"), false);
  } finally {
    if (previous === undefined) delete process.env.TECH_SHEET_REFRESH_TOKEN;
    else process.env.TECH_SHEET_REFRESH_TOKEN = previous;
  }
});

test("a configured token lets another service store a tech sheet", () => {
  const previous = process.env.TECH_SHEET_REFRESH_TOKEN;
  process.env.TECH_SHEET_REFRESH_TOKEN = "production-token";
  try {
    assert.equal(canStoreGeneratedTechSheet("10.0.0.8", "production-token"), true);
    assert.equal(canStoreGeneratedTechSheet("10.0.0.8", "local-tech-sheet-refresh"), false);
  } finally {
    if (previous === undefined) delete process.env.TECH_SHEET_REFRESH_TOKEN;
    else process.env.TECH_SHEET_REFRESH_TOKEN = previous;
  }
});
