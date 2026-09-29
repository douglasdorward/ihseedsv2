import { execFileSync } from "node:child_process";
import { accessSync, constants, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Browser, computeExecutablePath, install } from "@puppeteer/browsers";
import puppeteer, { type Browser as PuppeteerBrowser } from "puppeteer-core";

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

function chromiumVersion(entry: string) {
  const match = /-chromium-(?:unwrapped-)?(\d+(?:\.\d+)*)/.exec(entry);
  return match ? match[1].split(".").map(Number) : [];
}

function compareVersionsDescending(a: number[], b: number[]) {
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (b[index] ?? 0) - (a[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

/** The nix store can hold many old Chromium builds. Try the newest first; old ones cannot print with this puppeteer. */
export function nixStoreChromiumPaths(
  entries: string[],
  exists: (file: string) => boolean,
  store = "/nix/store",
) {
  const wrapped: Array<{ path: string; version: number[] }> = [];
  const unwrapped: Array<{ path: string; version: number[] }> = [];
  for (const entry of entries) {
    if (!entry.includes("-chromium-")) continue;
    const candidate = `${store}/${entry}/bin/chromium`;
    if (!exists(candidate)) continue;
    const found = { path: candidate, version: chromiumVersion(entry) };
    if (entry.includes("-chromium-unwrapped-")) unwrapped.push(found);
    else wrapped.push(found);
  }
  const chosen = wrapped.length > 0 ? wrapped : unwrapped;
  return chosen
    .sort((a, b) => compareVersionsDescending(a.version, b.version))
    .map((item) => item.path);
}

/** Chromium on the process PATH, such as the package the Replit environment installs. */
export function pathChromium(pathValue: string | undefined, exists: (file: string) => boolean) {
  const found: string[] = [];
  for (const dir of (pathValue ?? "").split(path.delimiter)) {
    if (!dir) continue;
    for (const name of ["chromium", "chromium-browser"]) {
      const candidate = path.join(dir, name);
      if (exists(candidate)) found.push(candidate);
    }
  }
  return found;
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
    ...pathChromium(env.PATH, canExecute),
    "/repl/tools/bin/chromium",
    home ? path.join(home, ".nix-profile/bin/chromium") : null,
    "/nix/var/nix/profiles/default/bin/chromium",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    bundledHeadlessShell(),
  ];
  const ready = rankChromeCandidates(discovered, canExecute);
  if (ready.length > 0) return ready;
  // Listing the nix store is slow, so it is only a fallback.
  const fallback = rankChromeCandidates(nixStoreChromiumPaths(nixStoreEntries(), canExecute), canExecute);
  if (fallback.length > 0) return fallback;
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

const launchArgs = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--no-first-run",
];

function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms.`)), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

export type TechSheetBrowserFailure = { executablePath: string; error: string };

/** Launch the first browser that starts, recording why the others did not. */
export async function launchTechSheetBrowser(candidates = chromeExecutableCandidates()) {
  const failures: TechSheetBrowserFailure[] = [];
  for (const executablePath of candidates) {
    try {
      const args = process.platform === "linux" ? [...launchArgs, "--no-zygote"] : launchArgs;
      const browser: PuppeteerBrowser = await withTimeout(puppeteer.launch({
        executablePath,
        headless: true,
        args,
      }), 20_000, "Tech sheet browser launch");
      return { browser, executablePath, failures };
    } catch (error) {
      failures.push({ executablePath, error: error instanceof Error ? error.message.split("\n")[0] : String(error) });
    }
  }
  const tried = failures.map((failure) => `${failure.executablePath}: ${failure.error}`).join("; ");
  throw new Error(candidates.length === 0
    ? "No Chromium browser was found to draw tech sheets."
    : `No Chromium browser could start to draw tech sheets. Tried ${tried}`);
}

/** Prove a browser on this machine can print a PDF. Run during publishing so a broken browser stops the build. */
export async function verifyTechSheetBrowser() {
  const { browser, executablePath, failures } = await launchTechSheetBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent("<!doctype html><p>Tech sheet browser check</p>");
    const pdf = await withTimeout(page.pdf({ printBackground: true }), 30_000, "Tech sheet browser check");
    if (Buffer.from(pdf).subarray(0, 5).toString() !== "%PDF-") {
      throw new Error(`${executablePath} did not produce a PDF.`);
    }
    return { executablePath, failures };
  } finally {
    await browser.close();
  }
}
