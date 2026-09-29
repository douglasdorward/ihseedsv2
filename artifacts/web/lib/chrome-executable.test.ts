import assert from "node:assert/strict";
import test from "node:test";
import { PUPPETEER_REVISIONS } from "puppeteer-core/internal/revisions.js";
import { nixStoreChromiumPaths, rankChromeCandidates, shouldInstallTechSheetBrowser, TECH_SHEET_BROWSER_BUILD } from "./chrome-executable.ts";

test("a configured browser path is used only when that file exists", () => {
  const files = new Set(["/opt/chromium"]);
  assert.deepEqual(
    rankChromeCandidates(["/missing/chromium", "/opt/chromium", "/opt/chromium"], (file) => files.has(file)),
    ["/opt/chromium"],
  );
});

test("the nix chromium wrapper is preferred to the unwrapped binary", () => {
  const store = "/nix/store";
  const wrapped = `${store}/abc-chromium-120.0.0/bin/chromium`;
  const unwrapped = `${store}/def-chromium-unwrapped-120.0.0/bin/chromium`;
  const entries = ["abc-chromium-120.0.0", "def-chromium-unwrapped-120.0.0", "unrelated"];
  assert.deepEqual(
    nixStoreChromiumPaths(entries, (file) => file === wrapped || file === unwrapped, store),
    [wrapped],
  );
});

test("linux publishes install a browser even when another Chrome is already on the machine", () => {
  assert.equal(shouldInstallTechSheetBrowser("linux", false, true), true);
  assert.equal(shouldInstallTechSheetBrowser("linux", true, true), false);
  assert.equal(shouldInstallTechSheetBrowser("darwin", false, true), false);
  assert.equal(shouldInstallTechSheetBrowser("darwin", false, false), true);
});

test("the bundled browser build matches puppeteer-core", () => {
  assert.equal(TECH_SHEET_BROWSER_BUILD, PUPPETEER_REVISIONS["chrome-headless-shell"]);
});
