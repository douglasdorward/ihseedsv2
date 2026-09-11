import { eq } from "drizzle-orm";
import { db, isActiveListing, productsTable, redirectsTable } from "@workspace/db";

function productSlugFromPath(fromPath: string) {
  const match = /^\/product\/([^/]+)$/.exec(fromPath);
  return match?.[1] ?? null;
}

export async function publicRedirectTo(fromPath: string) {
  const [redirect] = await db.select().from(redirectsTable)
    .where(eq(redirectsTable.fromPath, fromPath));
  if (!redirect) return null;
  const slug = productSlugFromPath(fromPath);
  if (slug) {
    const [product] = await db.select().from(productsTable).where(eq(productsTable.slug, slug));
    if (product?.publishStatus === "Published" && isActiveListing(product)) return null;
  }
  return redirect.toPath;
}
