import { backfillMediaUsage } from "../src/lib/media-usage";

const result = await backfillMediaUsage();
console.log(`Reconciled media usage for ${result.products} products.`);
