import { Router, type IRouter } from "express";
import { asc, eq, inArray } from "drizzle-orm";
import {
  catalogueCategoriesTable,
  db,
  insertCatalogueCategorySchema,
  productDraftsTable,
  productsTable,
  saleLinesTable,
  reorderCatalogueCategoriesSchema,
  updateCatalogueCategorySchema,
} from "@workspace/db";

const router: IRouter = Router();

function validId(rawId: string) {
  const id = Number(rawId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function isPostgresError(error: unknown, code: string) {
  let current: unknown = error;
  while (current && typeof current === "object") {
    if ("code" in current && current.code === code) return true;
    current = "cause" in current ? current.cause : null;
  }
  return false;
}

async function orderedCategories() {
  return db.select().from(catalogueCategoriesTable)
    .orderBy(asc(catalogueCategoriesTable.sortOrder), asc(catalogueCategoriesTable.name), asc(catalogueCategoriesTable.id));
}

async function validateParent(id: number | undefined, parentId: number | null, childCount = 0) {
  if (parentId === null) return null;
  if (id === parentId) return "A category cannot be its own parent.";
  if (childCount > 0) return "A category with children cannot be made a subcategory.";
  const [parent] = await db.select().from(catalogueCategoriesTable)
    .where(eq(catalogueCategoriesTable.id, parentId));
  if (!parent) return "Parent category not found.";
  if (parent.parentId !== null) return "Subcategories can only be nested one level deep.";
  return null;
}

router.get("/categories", async (_req, res): Promise<void> => {
  const [categories, products, saleLines] = await Promise.all([
    orderedCategories(),
    db.select({ id: productsTable.id, subcategoryId: productsTable.subcategoryId, publishStatus: productsTable.publishStatus, listingOverride: productsTable.listingOverride })
      .from(productsTable),
    db.select({ productId: saleLinesTable.productId, availability: saleLinesTable.availability }).from(saleLinesTable),
  ]);
  const availableProductIds = new Set(saleLines.filter((line) => line.availability !== "Unavailable").map((line) => line.productId));
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const activeIds = new Set(categories.filter((category) => category.active).map((category) => category.id));
  const counts = new Map<number, number>();
  for (const product of products) {
    if (product.publishStatus === "Published" && product.subcategoryId !== null &&
      (product.listingOverride === "Force active" ||
        (product.listingOverride !== "Force legacy" && (availableProductIds.has(product.id) || !saleLines.some((line) => line.productId === product.id))))) {
      const selected = categoriesById.get(product.subcategoryId);
      const selectedIsPublic = selected?.active
        && (selected.parentId === null || activeIds.has(selected.parentId));
      if (!selected || !selectedIsPublic) continue;
      counts.set(selected.id, (counts.get(selected.id) ?? 0) + 1);
      if (selected.parentId !== null) {
        counts.set(selected.parentId, (counts.get(selected.parentId) ?? 0) + 1);
      }
    }
  }
  res.json(categories.filter((category) => category.active && (category.parentId === null || activeIds.has(category.parentId))).map((category) => ({
    ...category,
    productCount: counts.get(category.id) ?? 0,
  })));
});

router.get("/admin/categories", async (_req, res): Promise<void> => {
  res.json(await orderedCategories());
});

router.post("/admin/categories", async (req, res): Promise<void> => {
  const parsed = insertCatalogueCategorySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Please provide valid category fields." });
    return;
  }
  const parentError = await validateParent(undefined, parsed.data.parentId);
  if (parentError) {
    res.status(400).json({ error: parentError });
    return;
  }
  try {
    const [category] = await db.insert(catalogueCategoriesTable).values(parsed.data).returning();
    res.status(201).json(category);
  } catch (error) {
    if (isPostgresError(error, "23505")) {
      res.status(409).json({ error: "A category with that slug already exists." });
      return;
    }
    throw error;
  }
});

router.patch("/admin/categories/:id", async (req, res): Promise<void> => {
  const id = validId(req.params.id);
  const parsed = updateCatalogueCategorySchema.safeParse(req.body);
  if (!id || !parsed.success || Object.keys(parsed.data).length === 0) {
    res.status(400).json({ error: "Please provide a valid category id and update." });
    return;
  }
  const [existing] = await db.select().from(catalogueCategoriesTable).where(eq(catalogueCategoriesTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Category not found." });
    return;
  }
  const children = await db.select({ id: catalogueCategoriesTable.id }).from(catalogueCategoriesTable)
    .where(eq(catalogueCategoriesTable.parentId, id));
  const parentId = parsed.data.parentId === undefined ? existing.parentId : parsed.data.parentId;
  const parentError = await validateParent(id, parentId, children.length);
  if (parentError) {
    res.status(400).json({ error: parentError });
    return;
  }
  try {
    const category = await db.transaction(async (tx) => {
      const [updated] = await tx.update(catalogueCategoriesTable)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(catalogueCategoriesTable.id, id)).returning();
      // A root name is the legacy-compatible product category label for itself
      // and for all of its children. Keep live records and pending snapshots aligned.
      if (existing.parentId === null && parsed.data.name && parsed.data.name !== existing.name) {
        const nextName = parsed.data.name;
        const children = await tx.select({ id: catalogueCategoriesTable.id }).from(catalogueCategoriesTable)
          .where(eq(catalogueCategoriesTable.parentId, id));
        const assignedIds = [id, ...children.map((child) => child.id)];
        await tx.update(productsTable).set({ category: nextName, updatedAt: new Date() })
          .where(inArray(productsTable.subcategoryId, assignedIds));
        const drafts = await tx.select().from(productDraftsTable);
        await Promise.all(drafts
          .filter((draft) => draft.snapshot.subcategoryId !== null && assignedIds.includes(draft.snapshot.subcategoryId))
          .map((draft) => tx.update(productDraftsTable)
            .set({
              snapshot: { ...draft.snapshot, category: nextName },
              updatedAt: new Date(),
            })
            .where(eq(productDraftsTable.id, draft.id))));
      }
      return updated;
    });
    res.json(category);
  } catch (error) {
    if (isPostgresError(error, "23505")) {
      res.status(409).json({ error: "A category with that slug already exists." });
      return;
    }
    throw error;
  }
});

router.post("/admin/categories/reorder", async (req, res): Promise<void> => {
  const parsed = reorderCatalogueCategoriesSchema.safeParse(req.body);
  if (!parsed.success || new Set(parsed.data.items.map((item) => item.id)).size !== parsed.data.items.length) {
    res.status(400).json({ error: "Provide unique category ids and sort orders." });
    return;
  }
  const result = await db.transaction(async (tx) => {
    const found = await tx.select({ id: catalogueCategoriesTable.id }).from(catalogueCategoriesTable);
    if (parsed.data.items.some((item) => !found.some((category) => category.id === item.id))) return false;
    await Promise.all(parsed.data.items.map((item) => tx.update(catalogueCategoriesTable)
      .set({ sortOrder: item.sortOrder, updatedAt: new Date() })
      .where(eq(catalogueCategoriesTable.id, item.id))));
    return true;
  });
  if (!result) {
    res.status(404).json({ error: "One or more categories were not found." });
    return;
  }
  res.json(await orderedCategories());
});

router.delete("/admin/categories/:id", async (req, res): Promise<void> => {
  const id = validId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid category id." });
    return;
  }
  const result = await db.transaction(async (tx) => {
    const [category] = await tx.select().from(catalogueCategoriesTable)
      .where(eq(catalogueCategoriesTable.id, id)).for("update");
    if (!category) return "not-found" as const;
    const [child] = await tx.select({ id: catalogueCategoriesTable.id }).from(catalogueCategoriesTable)
      .where(eq(catalogueCategoriesTable.parentId, id));
    const [product] = await tx.select({ id: productsTable.id }).from(productsTable)
      .where(eq(productsTable.subcategoryId, id));
    const drafts = await tx.select({ snapshot: productDraftsTable.snapshot }).from(productDraftsTable);
    const draftUsesCategory = drafts.some((draft) => draft.snapshot.subcategoryId === id);
    if (child || product || draftUsesCategory) return "in-use" as const;
    await tx.delete(catalogueCategoriesTable).where(eq(catalogueCategoriesTable.id, id));
    return "deleted" as const;
  });
  if (result === "not-found") {
    res.status(404).json({ error: "Category not found." });
    return;
  }
  if (result === "in-use") {
    res.status(409).json({ error: "This category has products or subcategories and cannot be deleted." });
    return;
  }
  res.sendStatus(204);
});

export default router;