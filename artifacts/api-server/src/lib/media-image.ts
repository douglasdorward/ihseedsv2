import sharp from "sharp";

const MAX_EDGE = 2400;
const WEBP_QUALITY = 80;

export type ConvertedWebp = {
  bytes: Buffer;
  width: number;
  height: number;
  contentType: "image/webp";
};

export async function convertToWebp(input: Buffer): Promise<ConvertedWebp> {
  const image = sharp(input, { failOn: "error" }).rotate();
  const meta = await image.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) throw new Error("The image has no dimensions.");
  const longest = Math.max(width, height);
  const pipeline = longest > MAX_EDGE
    ? image.resize({
      width: width >= height ? MAX_EDGE : undefined,
      height: height > width ? MAX_EDGE : undefined,
      fit: "inside",
      withoutEnlargement: true,
    })
    : image;
  const bytes = await pipeline.webp({ quality: WEBP_QUALITY }).toBuffer();
  const out = await sharp(bytes).metadata();
  return {
    bytes,
    width: out.width ?? width,
    height: out.height ?? height,
    contentType: "image/webp",
  };
}
