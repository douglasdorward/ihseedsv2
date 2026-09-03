import { Router, type IRouter } from "express";
import { asc, eq, inArray } from "drizzle-orm";
import {
  db,
  normalizeProductDetails,
  productDraftSchema,
  productDraftsTable,
  productsTable,
  updateProductSchema,
  type InsertProduct,
  type Product,
  type ProductEditablePayload,
} from "@workspace/db";
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

const createSlug = (name: string) =>
  name.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

function editableFromProduct(product: Product): ProductEditablePayload {
  return {
    name: product.name,
    price: product.price,
    packSize: product.packSize,
    status: product.status as ProductEditablePayload["status"],
    note: product.note,
    category: product.category,
    techSheet: product.techSheet,
    details: normalizeProductDetails(product.details, product.packSize),
  };
}

function normalizeEditable(payload: ProductEditablePayload): ProductEditablePayload {
  return { ...payload, details: normalizeProductDetails(payload.details, payload.packSize) };
}

async function ensureProducts() {
  const existing = await db.select().from(productsTable).orderBy(asc(productsTable.id));
  if (existing.length > 0) {
    const normalized = existing.map((product) => ({
      ...product,
      slug: product.slug || createSlug(product.name),
      details: normalizeProductDetails(product.details, product.packSize),
      publishedAt: product.publishStatus === "Published" && !product.publishedAt
        ? product.createdAt
        : product.publishedAt,
    }));
    const changed = normalized.filter((product, index) =>
      product.slug !== existing[index].slug ||
      JSON.stringify(product.details) !== JSON.stringify(existing[index].details) ||
      product.publishedAt?.getTime() !== existing[index].publishedAt?.getTime(),
    );
    if (changed.length > 0) {
      await Promise.all(changed.map((product) =>
        db.update(productsTable)
          .set({ slug: product.slug, details: product.details, publishedAt: product.publishedAt })
          .where(eq(productsTable.id, product.id)),
      ));
      return db.select().from(productsTable).orderBy(asc(productsTable.id));
    }
    return existing;
  }
  await db.insert(productsTable).values(seedProducts.map(([name, price, packSize, status, note]) => ({
    name,
    slug: createSlug(name),
    price,
    packSize,
    status,
    note,
    category: "Specialty Mixes",
    techSheet: "",
    publishStatus: "Published",
    publishedAt: new Date(),
  }))).onConflictDoNothing({ target: productsTable.name });
  return db.select().from(productsTable).orderBy(asc(productsTable.id));
}

async function findMissingProductReferences(details: InsertProduct["details"]) {
  const references = [...new Set([
    ...details.components.map((component) => component.productLink),
    ...details.companionSpecies,
    ...details.relatedProducts,
  ].filter(Boolean))];
  if (references.length === 0) return [];
  const existing = await db.select({ slug: productsTable.slug }).from(productsTable)
    .where(inArray(productsTable.slug, references));
  const known = new Set(existing.map((product) => product.slug));
  return references.filter((slug) => !known.has(slug));
}

async function getAdminProduct(product: Product) {
  const [draft] = await db.select().from(productDraftsTable)
    .where(eq(productDraftsTable.productId, product.id));
  return {
    ...product,
    details: normalizeProductDetails(product.details, product.packSize),
    lifecycleStatus: product.publishStatus,
    hasDraft: Boolean(draft),
    draftSavedAt: draft?.updatedAt ?? null,
    publishedAt: product.publishedAt,
    draft: draft ? { ...normalizeEditable(draft.snapshot), savedAt: draft.updatedAt } : null,
  };
}

async function findProduct(id: number) {
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id));
  return product;
}

function validId(rawId: string) {
  const id = Number(rawId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

router.get("/products", async (req, res): Promise<void> => {
  const products = await ensureProducts();
  res.json(products.filter((product) => product.publishStatus === "Published")
    .map((product) => ({ ...product, details: normalizeProductDetails(product.details, product.packSize) })));
});

router.post("/products", async (req, res): Promise<void> => {
  const parsed = insertProductSchema.safeParse({ ...req.body, publishStatus: "Draft" });
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.flatten() }, "Invalid product create request");
    res.status(400).json({ error: "Please complete all required product fields." });
    return;
  }
  const missingReferences = await findMissingProductReferences(parsed.data.details);
  if (missingReferences.length > 0) {
    res.status(400).json({ error: `Unknown linked product: ${missingReferences.join(", ")}.` });
    return;
  }
  try {
    const [product] = await db.insert(productsTable).values({
      ...parsed.data,
      publishStatus: "Draft",
      publishedAt: null,
    }).returning();
    req.log.info({ productId: product.id }, "Draft product created");
    res.status(201).json(product);
  } catch (error) {
    if (error instanceof Error && error.message.includes("duplicate key")) {
      res.status(409).json({ error: "A product with that name already exists." });
      return;
    }
    throw error;
  }
});

router.get("/admin/products", async (_req, res): Promise<void> => {
  const products = await ensureProducts();
  res.json(await Promise.all(products.map(getAdminProduct)));
});

router.get("/admin/products/:id", async (req, res): Promise<void> => {
  const id = validId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid product id." });
    return;
  }
  const product = await findProduct(id);
  if (!product) {
    res.status(404).json({ error: "Product not found." });
    return;
  }
  res.json(await getAdminProduct(product));
});

router.post("/admin/products/:id/draft", async (req, res): Promise<void> => {
  const id = validId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid product id." });
    return;
  }
  const product = await findProduct(id);
  if (!product) {
    res.status(404).json({ error: "Product not found." });
    return;
  }
  if (product.publishStatus === "Archived") {
    res.status(409).json({ error: "Archived products must be restored to Draft before editing." });
    return;
  }
  const parsed = productDraftSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Please complete all required product fields." });
    return;
  }
  const missingReferences = await findMissingProductReferences(parsed.data.details);
  if (missingReferences.length > 0) {
    res.status(400).json({ error: `Unknown linked product: ${missingReferences.join(", ")}.` });
    return;
  }
  const snapshot = normalizeEditable(parsed.data);
  try {
    const updated = await db.transaction(async (tx) => {
      const [lockedProduct] = await tx.select().from(productsTable)
        .where(eq(productsTable.id, id)).for("update");
      if (!lockedProduct) throw new Error("PRODUCT_NOT_FOUND");
      if (lockedProduct.publishStatus === "Archived") throw new Error("PRODUCT_ARCHIVED");
      if (lockedProduct.publishStatus === "Published") {
        const [existingDraft] = await tx.select().from(productDraftsTable)
          .where(eq(productDraftsTable.productId, id));
        if (existingDraft) {
          await tx.update(productDraftsTable)
            .set({ snapshot, updatedAt: new Date() })
            .where(eq(productDraftsTable.id, existingDraft.id));
        } else {
          await tx.insert(productDraftsTable).values({ productId: id, snapshot });
        }
        return lockedProduct;
      } else {
        const [draftProduct] = await tx.update(productsTable)
          .set({ ...snapshot, publishStatus: "Draft", updatedAt: new Date() })
          .where(eq(productsTable.id, id)).returning();
        return draftProduct;
      }
    });
    res.json(await getAdminProduct(updated));
  } catch (error) {
    if (error instanceof Error && error.message === "PRODUCT_NOT_FOUND") {
      res.status(404).json({ error: "Product not found." });
      return;
    }
    if (error instanceof Error && error.message === "PRODUCT_ARCHIVED") {
      res.status(409).json({ error: "Archived products must be restored to Draft before editing." });
      return;
    }
    if (error instanceof Error && error.message.includes("duplicate key")) {
      res.status(409).json({ error: "A product with that name already exists." });
      return;
    }
    throw error;
  }
});

router.post("/admin/products/:id/publish", async (req, res): Promise<void> => {
  const id = validId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid product id." });
    return;
  }
  const product = await findProduct(id);
  if (!product) {
    res.status(404).json({ error: "Product not found." });
    return;
  }
  if (product.publishStatus === "Archived") {
    res.status(409).json({ error: "Restore this product to Draft before publishing it." });
    return;
  }
  try {
    const updated = await db.transaction(async (tx) => {
      const [lockedProduct] = await tx.select().from(productsTable)
        .where(eq(productsTable.id, id)).for("update");
      if (!lockedProduct) throw new Error("PRODUCT_NOT_FOUND");
      if (lockedProduct.publishStatus === "Archived") throw new Error("PRODUCT_ARCHIVED");
      const [draft] = await tx.select().from(productDraftsTable)
        .where(eq(productDraftsTable.productId, id));
      const payload = draft?.snapshot ?? editableFromProduct(lockedProduct);
      const [published] = await tx.update(productsTable).set({
        ...normalizeEditable(payload),
        publishStatus: "Published",
        publishedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(productsTable.id, id)).returning();
      if (draft) await tx.delete(productDraftsTable).where(eq(productDraftsTable.id, draft.id));
      return published;
    });
    res.json(await getAdminProduct(updated));
  } catch (error) {
    if (error instanceof Error && error.message === "PRODUCT_NOT_FOUND") {
      res.status(404).json({ error: "Product not found." });
      return;
    }
    if (error instanceof Error && error.message === "PRODUCT_ARCHIVED") {
      res.status(409).json({ error: "Restore this product to Draft before publishing it." });
      return;
    }
    if (error instanceof Error && error.message.includes("duplicate key")) {
      res.status(409).json({ error: "A product with that name already exists." });
      return;
    }
    throw error;
  }
});

router.post("/admin/products/:id/archive", async (req, res): Promise<void> => {
  const id = validId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid product id." });
    return;
  }
  const product = await findProduct(id);
  if (!product) {
    res.status(404).json({ error: "Product not found." });
    return;
  }
  if (product.publishStatus === "Archived") {
    res.status(409).json({ error: "Product is already archived." });
    return;
  }
  const archiveResult = await db.transaction(async (tx) => {
    const [lockedProduct] = await tx.select().from(productsTable)
      .where(eq(productsTable.id, id)).for("update");
    if (!lockedProduct) return { kind: "not-found" as const };
    if (lockedProduct.publishStatus === "Archived") return { kind: "already-archived" as const };
    const [archived] = await tx.update(productsTable)
      .set({ publishStatus: "Archived", updatedAt: new Date() })
      .where(eq(productsTable.id, id)).returning();
    return { kind: "updated" as const, product: archived };
  });
  if (archiveResult.kind === "not-found") {
    res.status(404).json({ error: "Product not found." });
    return;
  }
  if (archiveResult.kind === "already-archived") {
    res.status(409).json({ error: "Product is already archived." });
    return;
  }
  const updated = archiveResult.product;
  res.json(await getAdminProduct(updated));
});

router.post("/admin/products/:id/restore", async (req, res): Promise<void> => {
  const id = validId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid product id." });
    return;
  }
  const product = await findProduct(id);
  if (!product) {
    res.status(404).json({ error: "Product not found." });
    return;
  }
  if (product.publishStatus !== "Archived") {
    res.status(409).json({ error: "Only archived products can be restored." });
    return;
  }
  const updated = await db.transaction(async (tx) => {
    const [lockedProduct] = await tx.select().from(productsTable)
      .where(eq(productsTable.id, id)).for("update");
    if (!lockedProduct || lockedProduct.publishStatus !== "Archived") {
      throw new Error("PRODUCT_NOT_ARCHIVED");
    }
    const [draft] = await tx.select().from(productDraftsTable)
      .where(eq(productDraftsTable.productId, id));
    const [restored] = await tx.update(productsTable).set({
      ...(draft ? normalizeEditable(draft.snapshot) : {}),
      publishStatus: "Draft",
      updatedAt: new Date(),
    }).where(eq(productsTable.id, id)).returning();
    if (draft) await tx.delete(productDraftsTable).where(eq(productDraftsTable.id, draft.id));
    return restored;
  }).catch((error: unknown) => {
    if (error instanceof Error && error.message === "PRODUCT_NOT_ARCHIVED") return null;
    throw error;
  });
  if (!updated) {
    res.status(409).json({ error: "Only archived products can be restored." });
    return;
  }
  res.json(await getAdminProduct(updated));
});

router.post("/admin/products/:id/discard-draft", async (req, res): Promise<void> => {
  const id = validId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid product id." });
    return;
  }
  const product = await findProduct(id);
  if (!product) {
    res.status(404).json({ error: "Product not found." });
    return;
  }
  if (product.publishStatus !== "Published") {
    res.status(409).json({ error: "Draft-only products should be deleted if they are no longer needed." });
    return;
  }
  const discardResult = await db.transaction(async (tx) => {
    const [lockedProduct] = await tx.select().from(productsTable)
      .where(eq(productsTable.id, id)).for("update");
    if (!lockedProduct) return { kind: "not-found" as const };
    if (lockedProduct.publishStatus !== "Published") return { kind: "not-published" as const };
    await tx.delete(productDraftsTable).where(eq(productDraftsTable.productId, id));
    return { kind: "discarded" as const, product: lockedProduct };
  });
  if (discardResult.kind === "not-found") {
    res.status(404).json({ error: "Product not found." });
    return;
  }
  if (discardResult.kind === "not-published") {
    res.status(409).json({ error: "Draft-only products should be deleted if they are no longer needed." });
    return;
  }
  res.json(await getAdminProduct(discardResult.product));
});

router.patch("/products/:id", async (req, res): Promise<void> => {
  const id = validId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid product id." });
    return;
  }
  const parsed = updateProductSchema.safeParse(req.body);
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    res.status(400).json({ error: "Please provide at least one valid product field." });
    return;
  }
  const { publishStatus, ...changes } = parsed.data;
  if (publishStatus) {
    res.status(409).json({ error: "Use the lifecycle actions to change publication status." });
    return;
  }
  if (changes.details) {
    const missingReferences = await findMissingProductReferences(changes.details);
    if (missingReferences.length > 0) {
      res.status(400).json({ error: `Unknown linked product: ${missingReferences.join(", ")}.` });
      return;
    }
  }
  const updateResult = await db.transaction(async (tx) => {
    const [lockedProduct] = await tx.select().from(productsTable)
      .where(eq(productsTable.id, id)).for("update");
    if (!lockedProduct) return { kind: "not-found" as const };
    if (lockedProduct.publishStatus === "Archived") return { kind: "archived" as const };
    if (lockedProduct.publishStatus === "Published" && Object.keys(changes).some((key) => key !== "status")) {
      return { kind: "published-content" as const };
    }
    const [updated] = await tx.update(productsTable)
      .set({ ...changes, updatedAt: new Date() })
      .where(eq(productsTable.id, id)).returning();
    if (lockedProduct.publishStatus === "Published" && changes.status) {
      const [draft] = await tx.select().from(productDraftsTable)
        .where(eq(productDraftsTable.productId, id));
      if (draft) {
        await tx.update(productDraftsTable)
          .set({ snapshot: { ...draft.snapshot, status: changes.status }, updatedAt: new Date() })
          .where(eq(productDraftsTable.id, draft.id));
      }
    }
    return { kind: "updated" as const, product: updated };
  });
  if (updateResult.kind === "not-found") {
    res.status(404).json({ error: "Product not found." });
    return;
  }
  if (updateResult.kind === "archived") {
    res.status(409).json({ error: "Restore this product before editing it." });
    return;
  }
  if (updateResult.kind === "published-content") {
    res.status(409).json({ error: "Published catalogue content must be saved as a draft." });
    return;
  }
  res.json(updateResult.product);
});

router.delete("/products/:id", async (req, res): Promise<void> => {
  const id = validId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid product id." });
    return;
  }
  const target = await findProduct(id);
  if (!target) {
    res.status(404).json({ error: "Product not found." });
    return;
  }
  const catalogue = await db.select().from(productsTable);
  const drafts = await db.select().from(productDraftsTable);
  const referencedBy = catalogue.filter((product) => {
    if (product.id === id) return false;
    const details = normalizeProductDetails(product.details, product.packSize);
    return details.relatedProducts.includes(target.slug) ||
      details.companionSpecies.includes(target.slug) ||
      details.components.some((component) => component.productLink === target.slug);
  });
  const draftReferences = drafts.filter((draft) => {
    if (draft.productId === id) return false;
    const details = normalizeProductDetails(draft.snapshot.details, draft.snapshot.packSize);
    return details.relatedProducts.includes(target.slug) ||
      details.companionSpecies.includes(target.slug) ||
      details.components.some((component) => component.productLink === target.slug);
  });
  if (referencedBy.length > 0 || draftReferences.length > 0) {
    const names = referencedBy.map((product) => product.name);
    res.status(409).json({ error: `This product is linked from: ${names.join(", ") || "a draft revision"}. Remove those links before deleting it.` });
    return;
  }
  await db.delete(productsTable).where(eq(productsTable.id, id));
  res.sendStatus(204);
});

router.get("/admin/summary", async (_req, res): Promise<void> => {
  const products = await ensureProducts();
  const recentProducts = [...products].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).slice(0, 5);
  res.json({
    totalProducts: products.filter((product) => product.publishStatus !== "Archived").length,
    publishedProducts: products.filter((product) => product.publishStatus === "Published").length,
    draftProducts: products.filter((product) => product.publishStatus === "Draft").length,
    archivedProducts: products.filter((product) => product.publishStatus === "Archived").length,
    pendingDrafts: (await db.select().from(productDraftsTable)).length,
    lowStockProducts: products.filter((product) => product.status === "low" || product.status === "very-low" || product.status === "unavailable").length,
    missingTechSheets: products.filter((product) => product.publishStatus !== "Archived" && !product.techSheet).length,
    recentProducts,
  });
});

router.get("/availability", async (_req, res): Promise<void> => {
  const products = await ensureProducts();
  res.json(products.filter((product) => product.publishStatus === "Published")
    .map(({ id, name, note, status }) => ({ id, name, note, status })));
});

export default router;