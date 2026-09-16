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

export type UploadMediaProgress =
  | { stage: "requesting"; percent: 0 }
  | { stage: "uploading"; percent: number }
  | { stage: "processing"; percent: 100 }
  | { stage: "complete"; percent: 100 };

type UploadMediaOptions = {
  onProgress?: (progress: UploadMediaProgress) => void;
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

function putFileWithProgress(
  uploadURL: string,
  file: File,
  onProgress?: UploadMediaOptions["onProgress"],
) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", uploadURL);
    request.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    request.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      onProgress?.({
        stage: "uploading",
        percent: Math.min(99, Math.max(0, Math.round((event.loaded / event.total) * 100))),
      });
    });
    request.addEventListener("load", () => {
      if (request.status === 401 || request.status === 403) window.dispatchEvent(new Event("admin:unauthorized"));
      if (request.status >= 200 && request.status < 300) {
        resolve();
        return;
      }
      let body: unknown = null;
      try {
        body = JSON.parse(request.responseText);
      } catch {
        // The fallback below includes the HTTP status when the response is not JSON.
      }
      reject(new Error(errorMessage(body, `Upload failed (${request.status})`)));
    });
    request.addEventListener("error", () => reject(new Error("The upload connection failed. Please try again.")));
    request.addEventListener("abort", () => reject(new Error("The upload was cancelled.")));
    onProgress?.({ stage: "uploading", percent: 0 });
    request.send(file);
  });
}

export async function uploadMediaAsset(file: File, options: UploadMediaOptions = {}): Promise<UploadedMediaPhoto> {
  options.onProgress?.({ stage: "requesting", percent: 0 });
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
  if (requested?.duplicate && requested.asset?.id) {
    options.onProgress?.({ stage: "complete", percent: 100 });
    return photoFromAsset(requested.asset, file.name);
  }

  const assetId = String(requested.assetId ?? requested.asset?.id ?? "");
  const uploadURL = String(requested.uploadURL ?? `/api/admin/media/${assetId}/object`);
  await putFileWithProgress(uploadURL, file, options.onProgress);

  options.onProgress?.({ stage: "processing", percent: 100 });
  const complete = await fetch(`/api/admin/media/${assetId}/complete`, { method: "POST" });
  const completed = await complete.json().catch(() => null);
  if (complete.status === 401 || complete.status === 403) window.dispatchEvent(new Event("admin:unauthorized"));
  if (complete.status === 409 && completed?.asset?.id) {
    options.onProgress?.({ stage: "complete", percent: 100 });
    return photoFromAsset(completed.asset, file.name);
  }
  if (!complete.ok) throw new Error(errorMessage(completed, `Upload failed (${complete.status})`));
  options.onProgress?.({ stage: "complete", percent: 100 });
  return photoFromAsset(completed, file.name);
}

export function photoDisplaySrc(photo: { src?: string; assetId?: string } | undefined) {
  if (photo?.assetId) return `/api/admin/media/${photo.assetId}/preview`;
  return photo?.src?.trim() || "";
}
