import { eq } from "drizzle-orm";
import { db, redirectsTable } from "@workspace/db";
import { normalizePublicPath } from "./product-path";

export async function publicRedirectTo(fromPath: string) {
  const path = normalizePublicPath(fromPath);
  const [redirect] = await db.select().from(redirectsTable)
    .where(eq(redirectsTable.fromPath, path));
  if (!redirect) return null;
  const destination = normalizePublicPath(redirect.toPath);
  return destination === path ? null : destination;
}
