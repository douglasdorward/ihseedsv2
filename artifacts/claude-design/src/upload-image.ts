export type UploadedMediaPhoto = {
  assetId: string;
  src: string;
  file: string;
  format: "webp";
  width?: number;
  height?: number;
  objectPath?: string | null;
  alt?: string;
};

type MediaAssetPayload = {
  id: string;
  originalFilename?: string;
  width?: number | null;
  height?: number | null;
  objectPath?: string | null;
  defaultAlt?: string;
  publicURL?: string | null;
};

function errorMessage(body: unknown, fallback: string) {
  if (body && typeof body === "object") {
    const record = body as { error?: unknown; message?: unknown };
    if (typeof record.error === "string") return record.error;
    if (typeof record.message === "string") return record.message;
  }
  return fallback;
}

function photoFromAsset(asset: MediaAssetPayload, filename: string): UploadedMediaPhoto {
  return {
    assetId: asset.id,
    src: `/api/media/${asset.id}`,
    file: filename || asset.originalFilename || "Image",
    format: "webp",
    width: asset.width ?? undefined,
    height: asset.height ?? undefined,
    objectPath: asset.objectPath,
    alt: asset.defaultAlt,
  };
}

export async function uploadMediaAsset(file: File): Promise<UploadedMediaPhoto> {
  const request = await fetch("/api/admin/media/upload-request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      originalFilename: file.name,
      contentType: file.type,
      bytes: file.size,
    }),
  });
  const requested = await request.json().catch(() => null);
  if (request.status === 401 || request.status === 403) window.dispatchEvent(new Event("admin:unauthorized"));
  if (!request.ok) throw new Error(errorMessage(requested, `Upload failed (${request.status})`));
  if (requested?.duplicate && requested.asset?.id) return photoFromAsset(requested.asset, file.name);

  const assetId = String(requested.assetId ?? requested.asset?.id ?? "");
  const uploadURL = String(requested.uploadURL ?? `/api/admin/media/${assetId}/object`);
  const put = await fetch(uploadURL, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (put.status === 401 || put.status === 403) window.dispatchEvent(new Event("admin:unauthorized"));
  if (!put.ok) {
    const body = await put.json().catch(() => null);
    throw new Error(errorMessage(body, `Upload failed (${put.status})`));
  }

  const complete = await fetch(`/api/admin/media/${assetId}/complete`, { method: "POST" });
  const completed = await complete.json().catch(() => null);
  if (complete.status === 401 || complete.status === 403) window.dispatchEvent(new Event("admin:unauthorized"));
  if (complete.status === 409 && completed?.asset?.id) return photoFromAsset(completed.asset, file.name);
  if (!complete.ok) throw new Error(errorMessage(completed, `Upload failed (${complete.status})`));
  return photoFromAsset(completed, file.name);
}

export function photoDisplaySrc(photo: { src?: string; assetId?: string } | undefined) {
  if (photo?.assetId) return `/api/admin/media/${photo.assetId}/preview`;
  return photo?.src?.trim() || "";
}
