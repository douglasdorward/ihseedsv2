import { Router, type IRouter } from "express";
import { db, productsTable } from "@workspace/db";
import { asc, desc, eq } from "drizzle-orm";
import { insertProductSchema } from "@workspace/db";

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
    .values(seedProducts.map(([name, price, packSize, status, note]) => ({
      name,
      price,
      packSize,
      status,
      note,
      category: "Specialty Mixes",
      techSheet: "",
      publishStatus: "Published",
    })))
    .onConflictDoNothing({ target: productsTable.name });
  return db.select().from(productsTable).orderBy(asc(productsTable.id));
}

router.get("/products", async (req, res): Promise<void> => {
  const products = await ensureProducts();
  req.log.info({ count: products.length }, "Loaded seed catalogue");
  res.json(products);
});

router.post("/products", async (req, res): Promise<void> => {
  const parsed = insertProductSchema.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.flatten() }, "Invalid product create request");
    res.status(400).json({ error: "Please complete all required product fields." });
    return;
  }

  try {
    const [product] = await db.insert(productsTable).values(parsed.data).returning();
    req.log.info({ productId: product.id }, "Product created");
    res.status(201).json(product);
  } catch (error) {
    if (error instanceof Error && error.message.includes("duplicate key")) {
      res.status(409).json({ error: "A product with that name already exists." });
      return;
    }
    throw error;
  }
});

router.patch("/products/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Invalid product id." });
    return;
  }

  const parsed = insertProductSchema.partial().safeParse(req.body);
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    req.log.warn({ errors: parsed.success ? "empty update" : parsed.error.flatten() }, "Invalid product update request");
    res.status(400).json({ error: "Please provide at least one valid product field." });
    return;
  }

  try {
    const [product] = await db
      .update(productsTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(productsTable.id, id))
      .returning();

    if (!product) {
      res.status(404).json({ error: "Product not found." });
      return;
    }

    req.log.info({ productId: product.id }, "Product updated");
    res.json(product);
  } catch (error) {
    if (error instanceof Error && error.message.includes("duplicate key")) {
      res.status(409).json({ error: "A product with that name already exists." });
      return;
    }
    throw error;
  }
});

router.delete("/products/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Invalid product id." });
    return;
  }

  const [product] = await db.delete(productsTable).where(eq(productsTable.id, id)).returning({ id: productsTable.id });
  if (!product) {
    res.status(404).json({ error: "Product not found." });
    return;
  }

  req.log.info({ productId: id }, "Product deleted");
  res.sendStatus(204);
});

router.get("/admin/summary", async (req, res): Promise<void> => {
  const products = await ensureProducts();
  const recentProducts = [...products].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).slice(0, 5);
  res.json({
    totalProducts: products.length,
    publishedProducts: products.filter((product) => product.publishStatus === "Published").length,
    lowStockProducts: products.filter((product) => product.status === "low" || product.status === "very-low" || product.status === "unavailable").length,
    missingTechSheets: products.filter((product) => !product.techSheet).length,
    recentProducts,
  });
  req.log.info({ totalProducts: products.length }, "Loaded admin product summary");
});

router.get("/availability", async (_req, res): Promise<void> => {
  const products = await ensureProducts();
  res.json(products.map(({ id, name, note, status }) => ({ id, name, note, status })));
});

export default router;