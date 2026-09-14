import { Router, type IRouter } from "express";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const router: IRouter = Router();

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};
const MAX_BYTES = 6 * 1024 * 1024;

function uploadsDir() {
  return path.resolve(process.cwd(), "uploads", "products");
}

router.post("/admin/uploads", async (req, res): Promise<void> => {
  const filename = typeof req.body?.filename === "string" ? req.body.filename : "";
  const mimeType = typeof req.body?.mimeType === "string" ? req.body.mimeType : "";
  const data = typeof req.body?.data === "string" ? req.body.data.replace(/^data:[^;]+;base64,/, "") : "";
  const extension = ALLOWED_TYPES[mimeType];
  if (!extension) {
    res.status(400).json({ message: "Upload a JPEG, PNG, WebP, or GIF image." });
    return;
  }
  let buffer: Buffer;
  try {
    buffer = Buffer.from(data, "base64");
  } catch {
    res.status(400).json({ message: "The image data was not valid." });
    return;
  }
  if (!buffer.length || buffer.length > MAX_BYTES) {
    res.status(400).json({ message: "Images must be between 1 byte and 6 MB." });
    return;
  }
  const safeStem = path.basename(filename, path.extname(filename)).replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "hero";
  const storedName = `${Date.now()}-${randomBytes(4).toString("hex")}-${safeStem}${extension}`;
  const directory = uploadsDir();
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, storedName), buffer);
  res.status(201).json({ src: `/uploads/products/${storedName}`, file: filename || storedName });
});

export function productUploadsDir() {
  return uploadsDir();
}

export default router;
