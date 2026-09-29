import { backfillGeneratedTechSheets } from "../src/lib/generated-tech-sheet";

const result = await backfillGeneratedTechSheets();
console.log(`Checked ${result.checked} tech sheets (${result.ready} ready, ${result.failed} failed).`);
if (result.failed > 0) process.exitCode = 1;
