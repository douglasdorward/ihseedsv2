import { backfillGeneratedTechSheets } from "../src/lib/generated-tech-sheet";

const result = await backfillGeneratedTechSheets();
console.log(`Generated ${result.stored} tech sheets (${result.failed} failed, ${result.queued} queued).`);
if (result.failed > 0) process.exitCode = 1;
