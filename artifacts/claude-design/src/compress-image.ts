export const IMAGE_MAX_EDGE = 2400;
export const IMAGE_MAX_BYTES = 12 * 1024 * 1024;
const WEBP_QUALITIES = [0.8, 0.65, 0.5];

export type DecodedImage = {
  width: number;
  height: number;
  close?: () => void;
};

export type ImageCompressor = {
  decode: (file: File) => Promise<DecodedImage | null>;
  encode: (image: DecodedImage, width: number, height: number, quality: number) => Promise<Blob | null>;
};

function targetSize(width: number, height: number) {
  const longest = Math.max(width, height);
  if (longest <= IMAGE_MAX_EDGE) return { width, height };
  const scale = IMAGE_MAX_EDGE / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function renamed(filename: string, type: string) {
  const extension = type === "image/jpeg" ? ".jpg" : type === "image/png" ? ".png" : ".webp";
  const base = filename.replace(/\.[^.]+$/, "") || "image";
  return `${base}${extension}`;
}

function blobFromCanvas(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

function browserImageCompressor(): ImageCompressor {
  return {
    async decode(file) {
      if (typeof createImageBitmap !== "function") return null;
      return createImageBitmap(file);
    },
    async encode(image, width, height, quality) {
      if (typeof document === "undefined") return null;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) return null;
      context.drawImage(image as CanvasImageSource, 0, 0, width, height);
      const webp = await blobFromCanvas(canvas, "image/webp", quality);
      if (webp?.type === "image/webp") return webp;
      return blobFromCanvas(canvas, "image/jpeg", quality);
    },
  };
}

export async function compressImageForUpload(file: File, compressor: ImageCompressor = browserImageCompressor()): Promise<File> {
  const supported = /^image\/(jpeg|png|webp)$/.test(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name);
  if (!file.size || !supported) return file;

  let decoded: DecodedImage | null = null;
  try {
    decoded = await compressor.decode(file);
  } catch {
    return file;
  }
  if (!decoded?.width || !decoded.height) return file;

  try {
    const size = targetSize(decoded.width, decoded.height);
    let chosen: Blob | null = null;
    for (const quality of WEBP_QUALITIES) {
      const blob = await compressor.encode(decoded, size.width, size.height, quality);
      if (!blob?.size) continue;
      chosen = blob;
      const fits = blob.size <= IMAGE_MAX_BYTES;
      const smaller = blob.size < file.size;
      if (fits && (smaller || file.size > IMAGE_MAX_BYTES)) break;
    }
    if (file.size > IMAGE_MAX_BYTES && (!chosen || chosen.size > IMAGE_MAX_BYTES)) {
      throw new Error("This image is still over 12 MB after compression. Use a smaller photo.");
    }
    if (!chosen || chosen.size >= file.size) return file;
    const type = chosen.type || "image/webp";
    return new File([chosen], renamed(file.name, type), { type, lastModified: file.lastModified });
  } finally {
    decoded.close?.();
  }
}
