import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

type StoredObject = {
  bytes: Buffer;
  contentType: string;
};

type ObjectStore = {
  put(key: string, bytes: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<StoredObject | null>;
  remove(key: string): Promise<void>;
};

export type AppStorageBackend = "local" | "replit";

export function appStorageBackend(): AppStorageBackend {
  const raw = process.env.APP_STORAGE_BACKEND?.trim().toLowerCase();
  if (raw === "local" || raw === "replit") return raw;
  if (raw) {
    throw new Error(`APP_STORAGE_BACKEND must be "local" or "replit", got "${process.env.APP_STORAGE_BACKEND}".`);
  }
  return process.env.REPL_ID ? "replit" : "local";
}

function uploadsRoot() {
  return path.resolve(process.cwd(), "uploads");
}

function localPath(key: string) {
  const safe = key.replace(/[^a-zA-Z0-9/_.=-]+/g, "-").replace(/^\/+/, "");
  // Media keys already include the media/ prefix and live next to tech-sheets/.
  // Tech-sheet keys also include tech-sheets/, but the historical local root is
  // uploads/tech-sheets, so those files stay at uploads/tech-sheets/tech-sheets/...
  if (safe.startsWith("media/") || safe.startsWith("site/")) return path.join(uploadsRoot(), safe);
  return path.join(uploadsRoot(), "tech-sheets", safe);
}

const localStore: ObjectStore = {
  async put(key, bytes) {
    const target = localPath(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
  },
  async get(key) {
    try {
      const bytes = await readFile(localPath(key));
      return { bytes, contentType: contentTypeFor(key) };
    } catch {
      return null;
    }
  },
  async remove(key) {
    try {
      await unlink(localPath(key));
    } catch {
      /* already gone */
    }
  },
};

let replitStore: ObjectStore | undefined;
let replitStoreError: Error | undefined;

export function downloadedObjectBytes(value: [Buffer | Uint8Array] | Buffer | Uint8Array) {
  const contents = Array.isArray(value) ? value[0] : value;
  if (!contents) return null;
  const bytes = Buffer.isBuffer(contents) ? contents : Buffer.from(contents);
  return bytes.length > 1 ? bytes : null;
}

async function replitObjectStore(): Promise<ObjectStore> {
  if (replitStore) return replitStore;
  if (replitStoreError) throw replitStoreError;
  try {
    const mod = await import("@replit/object-storage") as {
      Client: new () => {
        uploadFromBytes(name: string, contents: Buffer): Promise<{ ok: boolean; error?: unknown }>;
        downloadAsBytes(name: string): Promise<{ ok: boolean; value?: [Buffer | Uint8Array] | Buffer | Uint8Array; error?: unknown }>;
        delete(name: string): Promise<{ ok: boolean }>;
      };
    };
    const client = new mod.Client();
    replitStore = {
      async put(key, bytes) {
        const result = await client.uploadFromBytes(key, bytes);
        if (!result.ok) throw new Error(String(result.error ?? "App Storage upload failed"));
      },
      async get(key) {
        const result = await client.downloadAsBytes(key);
        if (!result.ok || result.value == null) return null;
        const bytes = downloadedObjectBytes(result.value);
        if (!bytes) return null;
        return { bytes, contentType: contentTypeFor(key) };
      },
      async remove(key) {
        await client.delete(key);
      },
    };
    return replitStore;
  } catch (error) {
    replitStoreError = new Error(
      `Replit App Storage is unavailable: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw replitStoreError;
  }
}

async function activeStore(): Promise<ObjectStore> {
  if (appStorageBackend() === "local") return localStore;
  return replitObjectStore();
}

export function contentTypeFor(filename: string) {
  const extension = path.extname(filename).toLowerCase();
  if (extension === ".pdf") return "application/pdf";
  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  return "application/octet-stream";
}

export async function putStoredFile(key: string, bytes: Buffer, contentType = contentTypeFor(key)) {
  await (await activeStore()).put(key, bytes, contentType);
}

export async function getStoredFile(key: string): Promise<StoredObject | null> {
  return (await activeStore()).get(key);
}

export async function removeStoredFile(key: string) {
  await (await activeStore()).remove(key);
}

export function techSheetPublicPath(id: number) {
  return `/api/admin/tech-sheets/${id}/file`;
}

export function mediaObjectPath(id: string, filename: string) {
  const safe = filename.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "image.webp";
  return `media/${id}/${safe}`;
}

export function mediaPreviewPath(id: string) {
  return `/api/admin/media/${id}/preview`;
}

export function mediaPublicPath(id: string) {
  return `/api/media/${id}`;
}
