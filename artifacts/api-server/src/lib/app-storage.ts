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

function localDir() {
  return path.resolve(process.cwd(), "uploads", "tech-sheets");
}

function localPath(key: string) {
  const safe = key.replace(/[^a-zA-Z0-9/_.=-]+/g, "-").replace(/^\/+/, "");
  return path.join(localDir(), safe);
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

let replitStore: ObjectStore | null | undefined;

async function replitObjectStore(): Promise<ObjectStore | null> {
  if (replitStore !== undefined) return replitStore;
  try {
    const mod = await import("@replit/object-storage") as {
      Client: new () => {
        uploadFromBytes(name: string, contents: Buffer): Promise<{ ok: boolean; error?: unknown }>;
        downloadAsBytes(name: string): Promise<{ ok: boolean; value?: Buffer | Uint8Array; error?: unknown }>;
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
        const value = result.value;
        const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
        if (bytes.length <= 1) return null;
        return { bytes, contentType: contentTypeFor(key) };
      },
      async remove(key) {
        await client.delete(key);
      },
    };
    return replitStore;
  } catch {
    replitStore = null;
    return null;
  }
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
  const remote = await replitObjectStore();
  if (remote) {
    try {
      await remote.put(key, bytes, contentType);
      return;
    } catch {
      /* fall through to durable local copy when App Storage is unavailable */
    }
  }
  await localStore.put(key, bytes, contentType);
}

export async function getStoredFile(key: string): Promise<StoredObject | null> {
  const remote = await replitObjectStore();
  if (remote) {
    const stored = await remote.get(key);
    if (stored) return stored;
  }
  return localStore.get(key);
}

export async function removeStoredFile(key: string) {
  const remote = await replitObjectStore();
  if (remote) {
    try {
      await remote.remove(key);
    } catch {
      /* continue */
    }
  }
  await localStore.remove(key);
}

export function techSheetPublicPath(id: number) {
  return `/api/admin/tech-sheets/${id}/file`;
}
