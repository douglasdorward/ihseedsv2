import { ensureTechSheetBrowser, verifyTechSheetBrowser } from "../lib/chrome-executable.ts";

await ensureTechSheetBrowser();

try {
  const { executablePath, failures } = await verifyTechSheetBrowser();
  for (const failure of failures) {
    console.warn(`Tech sheet browser skipped: ${failure.executablePath} (${failure.error})`);
  }
  console.log(`Tech sheet browser ready: ${executablePath}`);
} catch (error) {
  console.error("Tech sheets cannot be drawn on this machine, so customers would not be able to download them.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
