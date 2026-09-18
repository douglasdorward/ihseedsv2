import { Router, type IRouter } from "express";
import { and, asc, eq, sql } from "drizzle-orm";
import {
  db,
  insertResellerBrandSchema,
  insertResellerOutletSchema,
  reorderResellerItemsSchema,
  resellerBrandsTable,
  resellerOutletsTable,
  updateResellerBrandSchema,
  updateResellerOutletSchema,
  type ResellerBrand,
  type ResellerOutlet,
} from "@workspace/db";
import { clearResellerMediaReferences, syncResellerMediaReferences } from "../lib/media-usage";
import {
  commitResellerImport,
  dryRunResellerImport,
  RESELLER_IMPORT_TEMPLATE,
  resellerImportCsvFromBody,
} from "../lib/reseller-import";

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

function toAdminOutlet(outlet: ResellerOutlet) {
  return {
    ...outlet,
    createdAt: outlet.createdAt.toISOString(),
    updatedAt: outlet.updatedAt.toISOString(),
  };
}

function toPublicOutlet(outlet: ResellerOutlet) {
  return {
    id: outlet.id,
    name: outlet.name,
    address: outlet.address,
    suburb: outlet.suburb,
    postcode: outlet.postcode,
    region: outlet.region,
    phone: outlet.phone,
    email: outlet.email,
    mapsUrl: outlet.mapsUrl,
  };
}

function toAdminBrand(brand: ResellerBrand, outlets: ResellerOutlet[]) {
  return {
    ...brand,
    logoAssetId: brand.logoAssetId ?? null,
    createdAt: brand.createdAt.toISOString(),
    updatedAt: brand.updatedAt.toISOString(),
    outlets: outlets.map(toAdminOutlet),
  };
}

function toPublicBrand(brand: ResellerBrand, outlets: ResellerOutlet[]) {
  return {
    id: brand.id,
    name: brand.name,
    kind: brand.kind,
    website: brand.website,
    logoSrc: brand.logoSrc,
    logoAssetId: brand.logoAssetId ?? null,
    outlets: outlets.map(toPublicOutlet),
  };
}

async function orderedBrands() {
  return db.select().from(resellerBrandsTable)
    .orderBy(asc(resellerBrandsTable.sortOrder), asc(resellerBrandsTable.name), asc(resellerBrandsTable.id));
}

async function orderedOutlets() {
  return db.select().from(resellerOutletsTable)
    .orderBy(asc(resellerOutletsTable.sortOrder), asc(resellerOutletsTable.name), asc(resellerOutletsTable.id));
}

function groupOutlets(outlets: ResellerOutlet[]) {
  const map = new Map<number, ResellerOutlet[]>();
  for (const outlet of outlets) {
    const list = map.get(outlet.brandId) ?? [];
    list.push(outlet);
    map.set(outlet.brandId, list);
  }
  return map;
}

async function nextBrandSortOrder() {
  const [row] = await db.select({
    max: sql<number>`coalesce(max(${resellerBrandsTable.sortOrder}), -1)`,
  }).from(resellerBrandsTable);
  return Number(row?.max ?? -1) + 1;
}

async function nextOutletSortOrder(brandId: number) {
  const [row] = await db.select({
    max: sql<number>`coalesce(max(${resellerOutletsTable.sortOrder}), -1)`,
  }).from(resellerOutletsTable).where(eq(resellerOutletsTable.brandId, brandId));
  return Number(row?.max ?? -1) + 1;
}

async function loadAdminBrands() {
  const [brands, outlets] = await Promise.all([orderedBrands(), orderedOutlets()]);
  const grouped = groupOutlets(outlets);
  return brands.map((brand) => toAdminBrand(brand, grouped.get(brand.id) ?? []));
}

async function loadAdminBrand(id: number) {
  const [brand] = await db.select().from(resellerBrandsTable).where(eq(resellerBrandsTable.id, id));
  if (!brand) return null;
  const outlets = await db.select().from(resellerOutletsTable)
    .where(eq(resellerOutletsTable.brandId, id))
    .orderBy(asc(resellerOutletsTable.sortOrder), asc(resellerOutletsTable.name), asc(resellerOutletsTable.id));
  return toAdminBrand(brand, outlets);
}

router.get("/resellers", async (_req, res): Promise<void> => {
  const [brands, outlets] = await Promise.all([orderedBrands(), orderedOutlets()]);
  const grouped = groupOutlets(outlets);
  const listedBrands = brands
    .filter((brand) => brand.active)
    .map((brand) => {
      const listed = (grouped.get(brand.id) ?? []).filter((outlet) => outlet.active);
      return listed.length ? toPublicBrand(brand, listed) : null;
    })
    .filter((brand): brand is NonNullable<typeof brand> => Boolean(brand));
  res.json(listedBrands);
});

router.get("/admin/resellers", async (_req, res): Promise<void> => {
  res.json(await loadAdminBrands());
});

router.post("/admin/resellers", async (req, res): Promise<void> => {
  const parsed = insertResellerBrandSchema.safeParse({
    ...req.body,
    sortOrder: req.body?.sortOrder ?? await nextBrandSortOrder(),
  });
  if (!parsed.success) {
    res.status(400).json({ error: "Please provide valid reseller brand fields." });
    return;
  }
  try {
    const [brand] = await db.insert(resellerBrandsTable).values({
      ...parsed.data,
      updatedAt: new Date(),
    }).returning();
    await syncResellerMediaReferences(brand);
    res.status(201).json(toAdminBrand(brand, []));
  } catch (error) {
    if (isPostgresError(error, "23505")) {
      res.status(409).json({ error: "A reseller brand with that name already exists." });
      return;
    }
    throw error;
  }
});

router.post("/admin/resellers/reorder", async (req, res): Promise<void> => {
  const parsed = reorderResellerItemsSchema.safeParse(req.body);
  if (!parsed.success || new Set(parsed.data.items.map((item) => item.id)).size !== parsed.data.items.length) {
    res.status(400).json({ error: "Provide unique brand ids and sort orders." });
    return;
  }
  const result = await db.transaction(async (tx) => {
    const found = await tx.select({ id: resellerBrandsTable.id }).from(resellerBrandsTable);
    if (parsed.data.items.some((item) => !found.some((brand) => brand.id === item.id))) return false;
    await Promise.all(parsed.data.items.map((item) => tx.update(resellerBrandsTable)
      .set({ sortOrder: item.sortOrder, updatedAt: new Date() })
      .where(eq(resellerBrandsTable.id, item.id))));
    return true;
  });
  if (!result) {
    res.status(404).json({ error: "One or more reseller brands were not found." });
    return;
  }
  res.json(await loadAdminBrands());
});

router.post("/admin/resellers/outlets/reorder", async (req, res): Promise<void> => {
  const parsed = reorderResellerItemsSchema.safeParse(req.body);
  if (!parsed.success || new Set(parsed.data.items.map((item) => item.id)).size !== parsed.data.items.length) {
    res.status(400).json({ error: "Provide unique outlet ids and sort orders." });
    return;
  }
  const result = await db.transaction(async (tx) => {
    const found = await tx.select({ id: resellerOutletsTable.id }).from(resellerOutletsTable);
    if (parsed.data.items.some((item) => !found.some((outlet) => outlet.id === item.id))) return false;
    await Promise.all(parsed.data.items.map((item) => tx.update(resellerOutletsTable)
      .set({ sortOrder: item.sortOrder, updatedAt: new Date() })
      .where(eq(resellerOutletsTable.id, item.id))));
    return true;
  });
  if (!result) {
    res.status(404).json({ error: "One or more reseller outlets were not found." });
    return;
  }
  res.json(await loadAdminBrands());
});

router.get("/admin/resellers/import/template", (_req, res): void => {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="reseller-import-template.csv"');
  res.send(RESELLER_IMPORT_TEMPLATE);
});

router.post("/admin/resellers/import/dry-run", async (req, res): Promise<void> => {
  const csvText = resellerImportCsvFromBody(req.body);
  if (!csvText.trim()) {
    res.status(400).json({ error: "csvText is required." });
    return;
  }
  res.json(await dryRunResellerImport(csvText));
});

router.post("/admin/resellers/import/commit", async (req, res): Promise<void> => {
  const csvText = resellerImportCsvFromBody(req.body);
  const token = typeof req.body?.token === "string" ? req.body.token : "";
  if (!csvText.trim() || !token) {
    res.status(400).json({ error: "csvText and token are required." });
    return;
  }
  try {
    res.json(await commitResellerImport(csvText, token));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Import failed" });
  }
});

router.get("/admin/resellers/:id", async (req, res): Promise<void> => {
  const id = validId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Please provide a valid reseller brand id." });
    return;
  }
  const brand = await loadAdminBrand(id);
  if (!brand) {
    res.status(404).json({ error: "Reseller brand not found." });
    return;
  }
  res.json(brand);
});

router.patch("/admin/resellers/:id", async (req, res): Promise<void> => {
  const id = validId(req.params.id);
  const parsed = updateResellerBrandSchema.safeParse(req.body);
  if (!id || !parsed.success || Object.keys(parsed.data).length === 0) {
    res.status(400).json({ error: "Please provide a valid reseller brand id and update." });
    return;
  }
  try {
    const [brand] = await db.update(resellerBrandsTable).set({
      ...parsed.data,
      updatedAt: new Date(),
    }).where(eq(resellerBrandsTable.id, id)).returning();
    if (!brand) {
      res.status(404).json({ error: "Reseller brand not found." });
      return;
    }
    await syncResellerMediaReferences(brand);
    res.json(await loadAdminBrand(id));
  } catch (error) {
    if (isPostgresError(error, "23505")) {
      res.status(409).json({ error: "A reseller brand with that name already exists." });
      return;
    }
    throw error;
  }
});

router.delete("/admin/resellers/:id", async (req, res): Promise<void> => {
  const id = validId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Please provide a valid reseller brand id." });
    return;
  }
  await clearResellerMediaReferences(id);
  const [deleted] = await db.delete(resellerBrandsTable).where(eq(resellerBrandsTable.id, id)).returning({ id: resellerBrandsTable.id });
  if (!deleted) {
    res.status(404).json({ error: "Reseller brand not found." });
    return;
  }
  res.status(204).end();
});

router.post("/admin/resellers/:id/outlets", async (req, res): Promise<void> => {
  const brandId = validId(req.params.id);
  if (!brandId) {
    res.status(400).json({ error: "Please provide a valid reseller brand id." });
    return;
  }
  const [brand] = await db.select().from(resellerBrandsTable).where(eq(resellerBrandsTable.id, brandId));
  if (!brand) {
    res.status(404).json({ error: "Reseller brand not found." });
    return;
  }
  const parsed = insertResellerOutletSchema.safeParse({
    ...req.body,
    sortOrder: req.body?.sortOrder ?? await nextOutletSortOrder(brandId),
  });
  if (!parsed.success) {
    res.status(400).json({ error: "Please provide valid reseller outlet fields." });
    return;
  }
  try {
    const [outlet] = await db.insert(resellerOutletsTable).values({
      brandId,
      ...parsed.data,
      updatedAt: new Date(),
    }).returning();
    res.status(201).json(toAdminOutlet(outlet));
  } catch (error) {
    if (isPostgresError(error, "23505")) {
      res.status(409).json({ error: "An outlet with that name already exists for this brand." });
      return;
    }
    throw error;
  }
});

router.patch("/admin/resellers/:brandId/outlets/:id", async (req, res): Promise<void> => {
  const brandId = validId(req.params.brandId);
  const id = validId(req.params.id);
  const parsed = updateResellerOutletSchema.safeParse(req.body);
  if (!brandId || !id || !parsed.success || Object.keys(parsed.data).length === 0) {
    res.status(400).json({ error: "Please provide a valid outlet id and update." });
    return;
  }
  try {
    const [outlet] = await db.update(resellerOutletsTable).set({
      ...parsed.data,
      updatedAt: new Date(),
    }).where(and(eq(resellerOutletsTable.id, id), eq(resellerOutletsTable.brandId, brandId))).returning();
    if (!outlet) {
      res.status(404).json({ error: "Reseller outlet not found." });
      return;
    }
    res.json(toAdminOutlet(outlet));
  } catch (error) {
    if (isPostgresError(error, "23505")) {
      res.status(409).json({ error: "An outlet with that name already exists for this brand." });
      return;
    }
    throw error;
  }
});

router.delete("/admin/resellers/:brandId/outlets/:id", async (req, res): Promise<void> => {
  const brandId = validId(req.params.brandId);
  const id = validId(req.params.id);
  if (!brandId || !id) {
    res.status(400).json({ error: "Please provide a valid outlet id." });
    return;
  }
  const [deleted] = await db.delete(resellerOutletsTable)
    .where(and(eq(resellerOutletsTable.id, id), eq(resellerOutletsTable.brandId, brandId)))
    .returning({ id: resellerOutletsTable.id });
  if (!deleted) {
    res.status(404).json({ error: "Reseller outlet not found." });
    return;
  }
  res.status(204).end();
});

export default router;
