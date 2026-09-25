import type { SiteHeroImage } from "@workspace/api-client-react";

export const HERO_VIDEO_MAX_SECONDS = 30;
export const HERO_VIDEO_MAX_BYTES = 100 * 1024 * 1024;
export const HERO_VIDEO_ACCEPT = "video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm";

const VIDEO_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm", "video/x-m4v"]);
const VIDEO_EXTENSIONS = /\.(mp4|m4v|mov|webm)$/i;
const METADATA_TIMEOUT_MS = 15_000;

export type UploadHeroVideoProgress =
  | { stage: "checking"; percent: 0 }
  | { stage: "uploading"; percent: number }
  | { stage: "processing"; percent: 100 }
  | { stage: "complete"; percent: 100 };

export function isVideoFile(file: Pick<File, "type" | "name">) {
  return VIDEO_TYPES.has(file.type) || (!file.type && VIDEO_EXTENSIONS.test(file.name));
}

function errorMessage(body: unknown, fallback: string) {
  if (body && typeof body === "object") {
    const record = body as { error?: unknown; message?: unknown };
    if (typeof record.error === "string") return record.error;
    if (typeof record.message === "string") return record.message;
  }
  return fallback;
}

/**
 * Read the clip length in the browser before uploading. Resolves to null when
 * the browser cannot decode the file; the server still enforces the limit.
 */
export function readVideoDuration(file: File): Promise<number | null> {
  if (typeof document === "undefined" || typeof URL.createObjectURL !== "function") return Promise.resolve(null);
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    let settled = false;
    const finish = (value: number | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
      resolve(value);
    };
    const timer = window.setTimeout(() => finish(null), METADATA_TIMEOUT_MS);
    video.preload = "metadata";
    video.muted = true;
    video.addEventListener("loadedmetadata", () => {
      finish(Number.isFinite(video.duration) ? video.duration : null);
    });
    video.addEventListener("error", () => finish(null));
    video.src = url;
  });
}

/** Client-side safeguards that mirror the server so obvious mistakes fail before the upload starts. */
export async function validateHeroVideoFile(file: File) {
  if (!isVideoFile(file)) return "Upload an MP4, MOV, or WebM video.";
  if (file.size > HERO_VIDEO_MAX_BYTES) {
    return `Videos must be ${Math.round(HERO_VIDEO_MAX_BYTES / 1024 / 1024)} MB or smaller. This file is ${Math.round(file.size / 1024 / 1024)} MB.`;
  }
  if (!file.size) return "That video file is empty.";
  const duration = await readVideoDuration(file);
  if (duration !== null && duration > HERO_VIDEO_MAX_SECONDS + 0.5) {
    return `Hero videos must be ${HERO_VIDEO_MAX_SECONDS} seconds or shorter. This clip is ${Math.round(duration)} seconds; trim it and try again.`;
  }
  return null;
}

function putVideoWithProgress(file: File, onProgress?: (progress: UploadHeroVideoProgress) => void) {
  return new Promise<SiteHeroImage>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", "/api/admin/site-settings/hero-video");
    request.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    request.setRequestHeader("x-filename", file.name.replace(/[^\x20-\x7e]/g, "_").slice(0, 200));
    request.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      onProgress?.({ stage: "uploading", percent: Math.min(99, Math.max(0, Math.round((event.loaded / event.total) * 100))) });
    });
    request.upload.addEventListener("load", () => onProgress?.({ stage: "processing", percent: 100 }));
    request.addEventListener("load", () => {
      if (request.status === 401 || request.status === 403) window.dispatchEvent(new Event("admin:unauthorized"));
      let body: unknown = null;
      try {
        body = JSON.parse(request.responseText);
      } catch {
        // Non-JSON responses fall back to the status code below.
      }
      if (request.status >= 200 && request.status < 300 && body && typeof body === "object") {
        resolve(body as SiteHeroImage);
        return;
      }
      const fallback = request.status === 413
        ? "The video is too large to upload. Keep it under 100 MB."
        : `Video upload failed (${request.status})`;
      reject(new Error(errorMessage(body, fallback)));
    });
    request.addEventListener("error", () => reject(new Error("The upload connection failed. Please try again.")));
    request.addEventListener("abort", () => reject(new Error("The upload was cancelled.")));
    onProgress?.({ stage: "uploading", percent: 0 });
    request.send(file);
  });
}

/** Validate, upload and transcode a hero clip. Resolves to a slide ready for `heroImages`. */
export async function uploadHeroVideo(file: File, onProgress?: (progress: UploadHeroVideoProgress) => void): Promise<SiteHeroImage> {
  onProgress?.({ stage: "checking", percent: 0 });
  const problem = await validateHeroVideoFile(file);
  if (problem) throw new Error(problem);
  const slide = await putVideoWithProgress(file, onProgress);
  onProgress?.({ stage: "complete", percent: 100 });
  return {
    src: slide.src,
    assetId: null,
    kind: "video",
    posterSrc: slide.posterSrc ?? "",
    ...(typeof slide.durationSeconds === "number" ? { durationSeconds: slide.durationSeconds } : {}),
  };
}
