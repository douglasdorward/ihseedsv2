import { Router, type IRouter, type Response } from "express";
import { asc, eq, inArray } from "drizzle-orm";
import {
  catalogueCategoriesTable,
  db,
  forSearchMetadata,
  insertCatalogueCategorySchema,
  isActiveListing,
  productDraftsTable,
  productsTable,
  reorderCatalogueCategoriesSchema,
  updateCatalogueCategorySchema,
} from "@workspace/db";
import {
  CATEGORY_FAQ_AGENT_PROMPT,
  categoryFaqTemplateFile,
  commitCategoryFaqImport,
  dryRunCategoryFaqImport,
} from "../lib/category-faq-import";

const router: IRouter = Router();
const RESERVED_ROOT_SLUGS = new Set(["categories"]);

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

type CategoryRow = typeof catalogueCategoriesTable.$inferSelect;

function normalizedChildSlug(parentSlug: string, slug: string) {
  const prefix = `${parentSlug}-`;
  return slug.startsWith(prefix) ? slug.slice(prefix.length) : slug;
}

function reservedRootSlugError(parentId: number | null, slug: string) {
  if (parentId === null && RESERVED_ROOT_SLUGS.has(slug)) {
    return `"${slug}" is reserved for the catalogue index.`;
  }
  return null;
}

function withPlainSearchMetadata<T extends { seoTitle?: string; seoDescription?: string }>(data: T): T {
  return {
    ...data,
    ...(typeof data.seoTitle === "string" ? { seoTitle: forSearchMetadata(data.seoTitle) } : {}),
    ...(typeof data.seoDescription === "string" ? { seoDescription: forSearchMetadata(data.seoDescription) } : {}),
  };
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
  const [categories, products] = await Promise.all([
    orderedCategories(),
    db.select({ id: productsTable.id, subcategoryId: productsTable.subcategoryId, publishStatus: productsTable.publishStatus, listingState: productsTable.listingState })
      .from(productsTable),
  ]);
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const activeIds = new Set(categories.filter((category) => category.active).map((category) => category.id));
  const counts = new Map<number, number>();
  for (const product of products) {
    if (product.publishStatus === "Published" && product.subcategoryId !== null && isActiveListing(product)) {
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

function workbookFromBody(body: unknown) {
  return typeof (body as { workbookBase64?: unknown })?.workbookBase64 === "string"
    ? Buffer.from((body as { workbookBase64: string }).workbookBase64, "base64")
    : null;
}

function sendWorkbook(res: Response, filename: string, file: Buffer) {
  res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").attachment(filename).send(file);
}

router.get("/admin/categories/faqs/import/template", async (_req, res): Promise<void> => {
  sendWorkbook(res, "root-category-faqs-template.xlsx", await categoryFaqTemplateFile());
});

router.get("/admin/categories/faqs/import/prompt", (_req, res): void => {
  res.type("text/plain; charset=utf-8").send(CATEGORY_FAQ_AGENT_PROMPT);
});

router.post("/admin/categories/faqs/import/dry-run", async (req, res): Promise<void> => {
  const file = workbookFromBody(req.body);
  if (!file) {
    res.status(400).json({ error: "workbookBase64 is required." });
    return;
  }
  res.json(await dryRunCategoryFaqImport(file));
});

router.post("/admin/categories/faqs/import/commit", async (req, res): Promise<void> => {
  const file = workbookFromBody(req.body);
  const token = typeof req.body?.token === "string" ? req.body.token : "";
  if (!file || !token) {
    res.status(400).json({ error: "workbookBase64 and token are required." });
    return;
  }
  try {
    res.json(await commitCategoryFaqImport(file, token));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Import failed" });
  }
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
  const reservedSlugError = reservedRootSlugError(parsed.data.parentId, parsed.data.slug);
  if (reservedSlugError) {
    res.status(400).json({ error: reservedSlugError });
    return;
  }
  try {
    let values = parsed.data;
    if (values.parentId !== null) {
      const [parent] = await db.select().from(catalogueCategoriesTable)
        .where(eq(catalogueCategoriesTable.id, values.parentId));
      if (!parent) {
        res.status(400).json({ error: "Parent category not found." });
        return;
      }
      const slug = normalizedChildSlug(parent.slug, values.slug);
      if (!slug) {
        res.status(400).json({ error: "A subcategory slug must include text after its parent prefix." });
        return;
      }
      values = { ...values, slug };
    }
    const [category] = await db.insert(catalogueCategoriesTable).values(withPlainSearchMetadata(values)).returning();
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
  const requestedSlug = parsed.data.slug === undefined ? existing.slug : parsed.data.slug;
  const reservedSlugError = reservedRootSlugError(parentId, requestedSlug);
  if (reservedSlugError) {
    res.status(400).json({ error: reservedSlugError });
    return;
  }
  try {
    const category = await db.transaction(async (tx) => {
      const before = await tx.select().from(catalogueCategoriesTable);
      const parent = parentId === null ? null : before.find((category) => category.id === parentId);
      if (parentId !== null && !parent) throw new Error("PARENT_CATEGORY_NOT_FOUND");
      const slug = parent ? normalizedChildSlug(parent.slug, requestedSlug) : requestedSlug;
      if (!slug) throw new Error("EMPTY_CHILD_SLUG");
      const [updated] = await tx.update(catalogueCategoriesTable)
        .set({ ...withPlainSearchMetadata(parsed.data), slug, updatedAt: new Date() })
        .where(eq(catalogueCategoriesTable.id, id)).returning();
      if (!updated) throw new Error("CATEGORY_NOT_FOUND");
      const after = before.map((category) => category.id === id ? updated : category);
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
      // A moved category belongs to its destination root (or itself once
      // promoted to a root) for both live catalogue data and its pending
      // revision. Keeping these labels together prevents cross-root listings
      // and stale product breadcrumbs.
      if (updated.parentId !== existing.parentId) {
        const destinationRoot = updated.parentId === null
          ? updated
          : after.find((category) => category.id === updated.parentId);
        if (!destinationRoot) throw new Error("PARENT_CATEGORY_NOT_FOUND");
        await tx.update(productsTable).set({ category: destinationRoot.name, updatedAt: new Date() })
          .where(eq(productsTable.subcategoryId, id));
        const drafts = await tx.select().from(productDraftsTable);
        await Promise.all(drafts
          .filter((draft) => draft.snapshot.subcategoryId === id)
          .map((draft) => tx.update(productDraftsTable)
            .set({
              snapshot: { ...draft.snapshot, category: destinationRoot.name },
              updatedAt: new Date(),
            })
            .where(eq(productDraftsTable.id, draft.id))));
      }
      return updated;
    });
    res.json(category);
  } catch (error) {
    if (error instanceof Error && (error.message === "EMPTY_CHILD_SLUG" || error.message === "PARENT_CATEGORY_NOT_FOUND")) {
      res.status(400).json({ error: error.message === "EMPTY_CHILD_SLUG"
        ? "A subcategory slug must include text after its parent prefix."
        : "Parent category not found." });
      return;
    }
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