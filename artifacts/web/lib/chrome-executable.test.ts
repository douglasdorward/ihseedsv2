import assert from "node:assert/strict";
import test from "node:test";
import { PUPPETEER_REVISIONS } from "puppeteer-core/internal/revisions.js";
import { nixStoreChromiumPaths, pathChromium, rankChromeCandidates, shouldInstallTechSheetBrowser, TECH_SHEET_BROWSER_BUILD } from "./chrome-executable.ts";

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

test("the newest nix chromium is tried first", () => {
  const store = "/nix/store";
  const entries = ["a-ungoogled-chromium-92.0.4515.159", "b-chromium-138.0.7204.100", "c-chromium-98.0.4758.102", "d-chromium-131.0.6778.204"];
  assert.deepEqual(
    nixStoreChromiumPaths(entries, () => true, store),
    [
      `${store}/b-chromium-138.0.7204.100/bin/chromium`,
      `${store}/d-chromium-131.0.6778.204/bin/chromium`,
      `${store}/c-chromium-98.0.4758.102/bin/chromium`,
      `${store}/a-ungoogled-chromium-92.0.4515.159/bin/chromium`,
    ],
  );
});

test("chromium on the PATH is found", () => {
  const files = new Set(["/opt/nix/bin/chromium"]);
  assert.deepEqual(pathChromium("/usr/local/bin:/opt/nix/bin", (file) => files.has(file)), ["/opt/nix/bin/chromium"]);
  assert.deepEqual(pathChromium(undefined, () => true), []);
});
