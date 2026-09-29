import { execFileSync } from "node:child_process";
import { accessSync, constants, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Browser, computeExecutablePath, install } from "@puppeteer/browsers";

/** Keep in step with puppeteer-core's chrome-headless-shell revision. */
export const TECH_SHEET_BROWSER_BUILD = "153.0.8010.36";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function techSheetBrowserCacheDir() {
  return path.join(webRoot, ".chrome");
}

export function canExecute(file: string) {
  try {
    accessSync(file, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export function rankChromeCandidates(
  ordered: Array<string | null | undefined>,
  exists: (file: string) => boolean,
) {
  const unique: string[] = [];
  for (const value of ordered) {
    const trimmed = value?.trim();
    if (!trimmed || unique.includes(trimmed) || !exists(trimmed)) continue;
    unique.push(trimmed);
  }
  return unique;
}

export function nixStoreChromiumPaths(
  entries: string[],
  exists: (file: string) => boolean,
  store = "/nix/store",
) {
  const wrapped: string[] = [];
  const unwrapped: string[] = [];
  for (const entry of entries) {
    if (!entry.includes("-chromium-")) continue;
    const candidate = `${store}/${entry}/bin/chromium`;
    if (!exists(candidate)) continue;
    if (entry.includes("-chromium-unwrapped-")) unwrapped.push(candidate);
    else wrapped.push(candidate);
  }
  return wrapped.length > 0 ? wrapped : unwrapped;
}

function bundledHeadlessShell() {
  try {
    return computeExecutablePath({
      browser: Browser.CHROMEHEADLESSSHELL,
      buildId: TECH_SHEET_BROWSER_BUILD,
      cacheDir: techSheetBrowserCacheDir(),
    });
  } catch {
    return null;
  }
}

function loginShellChromium() {
  try {
    const found = execFileSync("bash", ["-lc", "command -v chromium"], {
      encoding: "utf8",
      timeout: 3_000,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim().split("\n").pop()?.trim();
    return found || null;
  } catch {
    return null;
  }
}

function nixStoreEntries() {
  try {
    return readdirSync("/nix/store");
  } catch {
    return [];
  }
}

/** Browsers that can render a tech sheet, best match first. */
export function chromeExecutableCandidates(env: NodeJS.ProcessEnv = process.env) {
  const home = env.HOME?.trim();
  const discovered = [
    env.CHROMIUM_PATH,
    env.CHROMIUM_BIN,
    "/repl/tools/bin/chromium",
    home ? path.join(home, ".nix-profile/bin/chromium") : null,
    "/nix/var/nix/profiles/default/bin/chromium",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    ...nixStoreChromiumPaths(nixStoreEntries(), canExecute),
    bundledHeadlessShell(),
  ];
  const ready = rankChromeCandidates(discovered, canExecute);
  if (ready.length > 0) return ready;
  return rankChromeCandidates([loginShellChromium()], canExecute);
}

export function shouldInstallTechSheetBrowser(platform: NodeJS.Platform, bundledReady: boolean, otherReady: boolean) {
  if (bundledReady) return false;
  if (platform === "linux") return true;
  return !otherReady;
}

export async function ensureTechSheetBrowser() {
  const bundled = bundledHeadlessShell();
  const bundledReady = Boolean(bundled && canExecute(bundled));
  const otherReady = chromeExecutableCandidates().some((candidate) => candidate !== bundled);
  if (!shouldInstallTechSheetBrowser(process.platform, bundledReady, otherReady)) return;
  await install({
    browser: Browser.CHROMEHEADLESSSHELL,
    buildId: TECH_SHEET_BROWSER_BUILD,
    cacheDir: techSheetBrowserCacheDir(),
    downloadProgressCallback: "default",
  });
  const installed = bundledHeadlessShell();
  if (!installed || !existsSync(installed)) {
    throw new Error("Tech sheet browser install did not produce a Chrome binary.");
  }
}
