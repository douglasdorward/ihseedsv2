import { Router, type IRouter } from "express";
import { db, productsTable } from "@workspace/db";
import { asc } from "drizzle-orm";

const router: IRouter = Router();

const seedProducts = [
  ["SouWest™ Pasture Mix", "$25.00 per kg", "25 kg bag", "in-stock", "Blended to order, 500 mm+ zones"],
  ["Maximix", "$25.00 per kg", "25 kg bag", "in-stock", "Versatile pasture mix for broad-acre sowing"],
  ["Silahay™ Mix", "$25.00 per kg", "25 kg bag", "low", "Hay and silage, mid rainfall"],
  ["Self Regeneration Pasture Mix", "$25.00 per kg", "25 kg bag", "in-stock", "Built for persistence and recovery"],
  ["Ceres PG One50 Ryegrass", "$14.50 per kg", "25 kg bag", "in-stock", "Perennial, 600 mm+ zones"],
  ["Margurita French Serradella", "$9.80 per kg", "25 kg bag", "low", "Reliable early-season legume"],
  ["SARDI Seven Lucerne", "$18.00 per kg", "25 kg bag", "in-stock", "High quality feed for rotational systems"],
  ["Dalkeith Subterranean Clover", "$11.20 per kg", "25 kg bag", "very-low", "Early season, 325–450 mm"],
] as const;

async function ensureProducts() {
  const existing = await db.select().from(productsTable).orderBy(asc(productsTable.id));
  if (existing.length > 0) return existing;
  await db
    .insert(productsTable)
    .values(seedProducts.map(([name, price, packSize, status, note]) => ({ name, price, packSize, status, note })))
    .onConflictDoNothing({ target: productsTable.name });
  return db.select().from(productsTable).orderBy(asc(productsTable.id));
}

router.get("/products", async (req, res): Promise<void> => {
  const products = await ensureProducts();
  req.log.info({ count: products.length }, "Loaded seed catalogue");
  res.json(products);
});

router.get("/availability", async (_req, res): Promise<void> => {
  const products = await ensureProducts();
  res.json(products.map(({ id, name, note, status }) => ({ id, name, note, status })));
});

export default router;