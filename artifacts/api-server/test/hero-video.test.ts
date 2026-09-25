import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

process.env.DATABASE_URL ??= "postgres://127.0.0.1:5432/ih_hero_video_unit_test";

const {
  HERO_VIDEO_MAX_BYTES,
  HeroVideoError,
  assertHeroVideoLimits,
  ffmpegBinary,
  sniffVideoContainer,
  transcodeHeroVideo,
} = await import("../src/lib/hero-video.ts");
const { pool } = await import("@workspace/db");

// Resolved before the tests are declared so `skip` can see it.
const ffmpeg = await ffmpegBinary();
let workDir = "";
let shortClip: Buffer | null = null;
let longClip: Buffer | null = null;
let audioOnly: Buffer | null = null;

function render(binary: string, output: string, args: string[]) {
  execFileSync(binary, ["-y", "-v", "error", "-nostdin", ...args, output], { stdio: "pipe" });
}

before(async () => {
  if (!ffmpeg) return;
  workDir = await mkdtemp(path.join(tmpdir(), "ih-hero-video-test-"));
  const short = path.join(workDir, "short.mp4");
  const long = path.join(workDir, "long.mp4");
  const audio = path.join(workDir, "audio.mp4");
  // A 60 fps 720p clip with a sound track: the transcoder must cap fps, drop audio and keep the picture.
  render(ffmpeg, short, [
    "-f", "lavfi", "-i", "testsrc=size=1280x720:rate=60:duration=2",
    "-f", "lavfi", "-i", "sine=frequency=440:duration=2",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest",
  ]);
  render(ffmpeg, long, [
    "-f", "lavfi", "-i", "testsrc=size=160x120:rate=10:duration=31.5",
    "-c:v", "libx264", "-pix_fmt", "yuv420p",
  ]);
  render(ffmpeg, audio, ["-f", "lavfi", "-i", "sine=frequency=440:duration=1", "-c:a", "aac"]);
  [shortClip, longClip, audioOnly] = await Promise.all([readFile(short), readFile(long), readFile(audio)]);
});

after(async () => {
  if (workDir) await rm(workDir, { recursive: true, force: true });
  await pool.end();
});

test("sniffVideoContainer recognises MP4/MOV and WebM signatures only", () => {
  const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypisom"), Buffer.alloc(8)]);
  const mov = Buffer.concat([Buffer.from([0, 0, 0, 0x08]), Buffer.from("moov"), Buffer.alloc(8)]);
  const webm = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(12)]);
  assert.equal(sniffVideoContainer(mp4), "mp4");
  assert.equal(sniffVideoContainer(mov), "mp4");
  assert.equal(sniffVideoContainer(webm), "webm");
  assert.equal(sniffVideoContainer(Buffer.from("%PDF-1.7 not a video")), null);
  assert.equal(sniffVideoContainer(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d])), null);
  assert.equal(sniffVideoContainer(Buffer.alloc(3)), null);
});

test("assertHeroVideoLimits rejects clips over 30 seconds or larger than 4K", () => {
  assert.doesNotThrow(() => assertHeroVideoLimits({ durationSeconds: 30.4, width: 3840, height: 2160, fps: 30, codec: "h264" }));
  assert.throws(
    () => assertHeroVideoLimits({ durationSeconds: 31, width: 1920, height: 1080, fps: 30, codec: "h264" }),
    (error: unknown) => error instanceof HeroVideoError && error.status === 400 && /30 seconds/.test(error.message),
  );
  assert.throws(
    () => assertHeroVideoLimits({ durationSeconds: 5, width: 8192, height: 4320, fps: 30, codec: "h264" }),
    (error: unknown) => error instanceof HeroVideoError && /4K/.test(error.message),
  );
});

test("transcodeHeroVideo rejects junk and oversized payloads before touching ffmpeg", async () => {
  await assert.rejects(
    () => transcodeHeroVideo(Buffer.from("definitely not a video file at all")),
    (error: unknown) => error instanceof HeroVideoError && error.status === 400 && /MP4, MOV, or WebM/.test(error.message),
  );
  await assert.rejects(
    () => transcodeHeroVideo(Buffer.alloc(0)),
    (error: unknown) => error instanceof HeroVideoError && /empty/.test(error.message),
  );
  const oversized = Buffer.alloc(HERO_VIDEO_MAX_BYTES + 1);
  oversized.write("ftyp", 4, "latin1");
  await assert.rejects(
    () => transcodeHeroVideo(oversized),
    (error: unknown) => error instanceof HeroVideoError && error.status === 413,
  );
});

test("transcodeHeroVideo produces a muted, capped H.264 MP4 and a WebP poster", { skip: !ffmpeg && "ffmpeg binary unavailable" }, async () => {
  assert.ok(shortClip);
  const converted = await transcodeHeroVideo(shortClip);
  assert.equal(converted.contentType, "video/mp4");
  assert.equal(converted.posterContentType, "image/webp");
  assert.equal(sniffVideoContainer(converted.mp4), "mp4");
  assert.equal(converted.poster.subarray(0, 4).toString(), "RIFF");
  assert.equal(converted.poster.subarray(8, 12).toString(), "WEBP");
  assert.equal(converted.width, 1280);
  assert.equal(converted.height, 720);
  assert.ok(converted.durationSeconds > 1.5 && converted.durationSeconds <= 2.5, `duration ${converted.durationSeconds}`);
  assert.ok(converted.mp4.length > 0 && converted.mp4.length < shortClip.length * 2);
  // No audio track survives: the muted hero never needs one.
  assert.equal(converted.mp4.includes(Buffer.from("mp4a")), false);
});

test("transcodeHeroVideo rejects clips longer than 30 seconds with a clear message", { skip: !ffmpeg && "ffmpeg binary unavailable" }, async () => {
  assert.ok(longClip);
  await assert.rejects(
    () => transcodeHeroVideo(longClip),
    (error: unknown) => error instanceof HeroVideoError && error.status === 400 && /30 seconds or shorter/.test(error.message),
  );
});

test("transcodeHeroVideo rejects files without a video track", { skip: !ffmpeg && "ffmpeg binary unavailable" }, async () => {
  assert.ok(audioOnly);
  await assert.rejects(
    () => transcodeHeroVideo(audioOnly),
    (error: unknown) => error instanceof HeroVideoError && /no video track/.test(error.message),
  );
});
