import { execFile } from "node:child_process";
import { access, constants, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";
import { HERO_VIDEO_MAX_SECONDS } from "@workspace/db";

const execFileAsync = promisify(execFile);

/** Raw upload ceiling. A 30 second phone clip at 4K is well inside this. */
export const HERO_VIDEO_MAX_BYTES = 100 * 1024 * 1024;
/** Reject absurd source dimensions before spending CPU on them. */
export const HERO_VIDEO_MAX_SOURCE_EDGE = 4096;
/** ffprobe rounds; allow a little slack so a "30 second" phone clip at 30.2 s passes. */
export const HERO_VIDEO_DURATION_TOLERANCE_SECONDS = 0.5;

const OUTPUT_MAX_WIDTH = 1920;
const OUTPUT_MAX_HEIGHT = 1080;
const OUTPUT_MAX_FPS = 30;
const OUTPUT_CRF = "28";
const POSTER_WEBP_QUALITY = 80;
const PROBE_TIMEOUT_MS = 30_000;
const TRANSCODE_TIMEOUT_MS = 120_000;
const MAX_STDOUT_BYTES = 8 * 1024 * 1024;

export type HeroVideoContainer = "mp4" | "webm";

export class HeroVideoError extends Error {
  readonly status: 400 | 413 | 503;

  constructor(message: string, status: 400 | 413 | 503 = 400) {
    super(message);
    this.name = "HeroVideoError";
    this.status = status;
  }
}

/** ISO base media (MP4/MOV) files start with a top-level box; legacy QuickTime may lead with moov/mdat/wide. */
const ISO_BMFF_LEADING_BOXES = new Set(["ftyp", "moov", "mdat", "wide", "free", "skip"]);

/** MP4/MOV files carry a box type at byte 4; WebM/Matroska starts with the EBML magic. */
export function sniffVideoContainer(bytes: Buffer): HeroVideoContainer | null {
  if (bytes.length < 12) return null;
  if (ISO_BMFF_LEADING_BOXES.has(bytes.subarray(4, 8).toString("latin1"))) return "mp4";
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return "webm";
  return null;
}

export type ProbedVideo = {
  durationSeconds: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
};

type FfprobeStream = {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  duration?: string;
  r_frame_rate?: string;
  avg_frame_rate?: string;
};

type FfprobeOutput = {
  streams?: FfprobeStream[];
  format?: { duration?: string };
};

async function executablePath(envName: string, load: () => Promise<string | null | undefined>) {
  const fromEnv = process.env[envName]?.trim();
  const candidate = fromEnv || (await load().catch(() => null));
  if (!candidate) return null;
  try {
    await access(candidate, constants.X_OK);
    return candidate;
  } catch {
    return null;
  }
}

export async function ffmpegBinary() {
  return executablePath("FFMPEG_PATH", async () => {
    const mod = await import("ffmpeg-static") as { default?: string | null } | string | null;
    return typeof mod === "string" ? mod : mod?.default ?? null;
  });
}

export async function ffprobeBinary() {
  return executablePath("FFPROBE_PATH", async () => {
    const mod = await import("ffprobe-static") as { default?: { path?: string }; path?: string };
    return mod.path ?? mod.default?.path ?? null;
  });
}

const UNAVAILABLE = "Video processing is not available on this server right now. Photos can still be added.";

async function requireBinaries() {
  const [ffmpeg, ffprobe] = await Promise.all([ffmpegBinary(), ffprobeBinary()]);
  if (!ffmpeg || !ffprobe) throw new HeroVideoError(UNAVAILABLE, 503);
  return { ffmpeg, ffprobe };
}

function parseRate(value: string | undefined) {
  if (!value) return 0;
  const [num, den] = value.split("/").map(Number);
  if (!Number.isFinite(num) || !num) return 0;
  if (den === undefined) return num;
  return Number.isFinite(den) && den > 0 ? num / den : 0;
}

function describeSeconds(seconds: number) {
  return `${Math.round(seconds * 10) / 10} seconds`;
}

async function runTool(binary: string, args: string[], timeout: number) {
  try {
    return await execFileAsync(binary, args, { timeout, maxBuffer: MAX_STDOUT_BYTES, windowsHide: true });
  } catch (error) {
    const err = error as NodeJS.ErrnoException & { killed?: boolean; signal?: string; stderr?: string };
    if (err.code === "ENOENT" || err.code === "EACCES") throw new HeroVideoError(UNAVAILABLE, 503);
    if (err.killed || err.signal === "SIGTERM") {
      throw new HeroVideoError("The video took too long to process. Try a shorter or smaller clip.");
    }
    throw new HeroVideoError("The video could not be read. Upload an MP4, MOV, or WebM clip.");
  }
}

export async function probeVideoFile(filePath: string, ffprobe?: string): Promise<ProbedVideo> {
  const binary = ffprobe ?? (await requireBinaries()).ffprobe;
  const { stdout } = await runTool(binary, [
    "-v", "error",
    "-print_format", "json",
    "-show_format",
    "-show_streams",
    "-select_streams", "v:0",
    filePath,
  ], PROBE_TIMEOUT_MS);
  let parsed: FfprobeOutput;
  try {
    parsed = JSON.parse(stdout) as FfprobeOutput;
  } catch {
    throw new HeroVideoError("The video could not be read. Upload an MP4, MOV, or WebM clip.");
  }
  const stream = parsed.streams?.find((item) => item.codec_type === "video");
  if (!stream) throw new HeroVideoError("That file has no video track. Upload an MP4, MOV, or WebM clip.");
  const width = Number(stream.width) || 0;
  const height = Number(stream.height) || 0;
  if (!width || !height) throw new HeroVideoError("The video has no picture dimensions and cannot be used.");
  const durationSeconds = Number(parsed.format?.duration) || Number(stream.duration) || 0;
  if (!durationSeconds) throw new HeroVideoError("The video length could not be read. Re-export the clip and try again.");
  return {
    durationSeconds,
    width,
    height,
    fps: parseRate(stream.avg_frame_rate) || parseRate(stream.r_frame_rate),
    codec: stream.codec_name ?? "",
  };
}

export function assertHeroVideoLimits(probe: ProbedVideo) {
  if (probe.durationSeconds > HERO_VIDEO_MAX_SECONDS + HERO_VIDEO_DURATION_TOLERANCE_SECONDS) {
    throw new HeroVideoError(
      `Hero videos must be ${HERO_VIDEO_MAX_SECONDS} seconds or shorter. This clip is ${describeSeconds(probe.durationSeconds)}; trim it and try again.`,
    );
  }
  if (probe.width > HERO_VIDEO_MAX_SOURCE_EDGE || probe.height > HERO_VIDEO_MAX_SOURCE_EDGE) {
    throw new HeroVideoError(`The video is ${probe.width}×${probe.height}. Export it at 4K (${HERO_VIDEO_MAX_SOURCE_EDGE} px) or smaller.`);
  }
}

export type TranscodedHeroVideo = {
  mp4: Buffer;
  poster: Buffer;
  width: number;
  height: number;
  durationSeconds: number;
  contentType: "video/mp4";
  posterContentType: "image/webp";
};

/**
 * Validate an uploaded clip and convert it to a muted, web-optimised H.264 MP4
 * capped at 30 seconds and 1080p, plus a WebP poster frame. Temporary files are
 * always removed, including on failure.
 */
export async function transcodeHeroVideo(input: Buffer): Promise<TranscodedHeroVideo> {
  if (!input.length) throw new HeroVideoError("The uploaded video was empty.");
  if (input.length > HERO_VIDEO_MAX_BYTES) {
    throw new HeroVideoError(`Videos must be ${Math.round(HERO_VIDEO_MAX_BYTES / 1024 / 1024)} MB or smaller.`, 413);
  }
  const container = sniffVideoContainer(input);
  if (!container) throw new HeroVideoError("Upload an MP4, MOV, or WebM video.");
  const { ffmpeg, ffprobe } = await requireBinaries();
  const workDir = await mkdtemp(path.join(tmpdir(), "ih-hero-video-"));
  try {
    const sourcePath = path.join(workDir, `source.${container}`);
    const outputPath = path.join(workDir, "video.mp4");
    const posterPath = path.join(workDir, "poster.png");
    await writeFile(sourcePath, input);

    const source = await probeVideoFile(sourcePath, ffprobe);
    assertHeroVideoLimits(source);

    const encodeArgs = [
      "-y", "-v", "error", "-nostdin",
      "-i", sourcePath,
      "-t", String(HERO_VIDEO_MAX_SECONDS),
      "-map", "0:v:0",
      "-an", "-sn", "-dn",
      "-map_metadata", "-1",
      "-vf", `scale='min(iw,${OUTPUT_MAX_WIDTH})':'min(ih,${OUTPUT_MAX_HEIGHT})':force_original_aspect_ratio=decrease:force_divisible_by=2`,
      ...(source.fps > OUTPUT_MAX_FPS ? ["-r", String(OUTPUT_MAX_FPS)] : []),
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", OUTPUT_CRF,
      "-pix_fmt", "yuv420p",
      "-profile:v", "high",
      "-level", "4.1",
      "-movflags", "+faststart",
      "-f", "mp4",
      outputPath,
    ];
    await runTool(ffmpeg, encodeArgs, TRANSCODE_TIMEOUT_MS);

    const output = await probeVideoFile(outputPath, ffprobe);
    const posterAt = Math.min(0.5, output.durationSeconds / 2);
    await runTool(ffmpeg, [
      "-y", "-v", "error", "-nostdin",
      "-ss", posterAt.toFixed(2),
      "-i", outputPath,
      "-frames:v", "1",
      "-f", "image2", "-c:v", "png",
      posterPath,
    ], PROBE_TIMEOUT_MS);
    const poster = await sharp(await readFile(posterPath)).webp({ quality: POSTER_WEBP_QUALITY }).toBuffer();
    const mp4 = await readFile(outputPath);
    if (!mp4.length) throw new HeroVideoError("The video could not be converted. Try exporting it again as MP4.");
    return {
      mp4,
      poster,
      width: output.width,
      height: output.height,
      durationSeconds: Math.round(Math.min(output.durationSeconds, HERO_VIDEO_MAX_SECONDS) * 100) / 100,
      contentType: "video/mp4",
      posterContentType: "image/webp",
    };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
