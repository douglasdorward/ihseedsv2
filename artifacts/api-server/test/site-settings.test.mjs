import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const serverRoot = new URL("..", import.meta.url);
const testRunId = `${process.pid}-${Date.now()}`;
const createdAssetIds = [];
let child;
let baseUrl;

const ffmpegPath = await import("ffmpeg-static")
  .then((mod) => (typeof mod.default === "string" && existsSync(mod.default) ? mod.default : null))
  .catch(() => null);
let clipDir = "";

/** Render a tiny synthetic H.264 clip with ffmpeg's test pattern source. */
function renderClip(name, source) {
  if (!clipDir) clipDir = mkdtempSync(path.join(tmpdir(), "ih-site-settings-clips-"));
  const output = path.join(clipDir, name);
  execFileSync(ffmpegPath, [
    "-y", "-v", "error", "-nostdin",
    "-f", "lavfi", "-i", source,
    "-c:v", "libx264", "-pix_fmt", "yuv420p",
    output,
  ], { stdio: "pipe" });
  return readFileSync(output);
}

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const PNG_RED_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
  "base64",
);
const PNG_BLUE_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNgYPgPAAEDAQAIicLsAAAAAElFTkSuQmCC",
  "base64",
);
const PNG_GREEN_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNg+M8AAAICAQB7CYF4AAAAAElFTkSuQmCC",
  "base64",
);
const PNG_WHITE_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=",
  "base64",
);
const MINI_PDF = Buffer.from("%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : null;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  assert.ok(port, "Expected the test port to be assigned");
  return port;
}

async function waitForServer() {
  let lastError;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`API server exited before becoming ready: ${lastError?.message ?? "unknown error"}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/healthz`);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`API server did not become ready: ${lastError?.message ?? "unknown error"}`);
}

async function stopChild(processToStop) {
  if (!processToStop || processToStop.exitCode !== null) return;
  processToStop.kill("SIGTERM");
  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      processToStop.kill("SIGKILL");
      resolve();
    }, 2_000);
    processToStop.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

async function request(method, path, body, raw) {
  const response = await fetch(`${baseUrl}/api${path}`, {
    method,
    headers: raw
      ? { "content-type": raw }
      : body === undefined ? undefined : { "content-type": "application/json" },
    body: raw ? body : body === undefined ? undefined : JSON.stringify(body),
  });
  const buffer = Buffer.from(await response.arrayBuffer());
  const text = buffer.toString("utf8");
  let data;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = buffer;
  }
  return { response, data, buffer };
}

function assertStatus(result, status) {
  assert.equal(result.response.status, status, typeof result.data === "object" ? JSON.stringify(result.data) : String(result.data));
  return result.data;
}

async function uploadPng(filename = `site-settings-${testRunId}.png`, bytes = PNG_1X1) {
  const requested = assertStatus(await request("POST", "/admin/media/upload-request", {
    originalFilename: filename,
    contentType: "image/png",
    bytes: bytes.length,
  }), 201);
  createdAssetIds.push(requested.assetId);
  assertStatus(await request("PUT", `/admin/media/${requested.assetId}/object`, bytes, "image/png"), 204);
  return assertStatus(await request("POST", `/admin/media/${requested.assetId}/complete`), 200);
}

before(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for site settings API tests");
  }
  if (!/^ih_catalogue_test_\d+_\d+$/.test(process.env.CATALOGUE_TEST_DATABASE ?? "")) {
    throw new Error("Site settings API tests must run through the isolated lifecycle-test runner");
  }
  const port = await freePort();
  baseUrl = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ["--enable-source-maps", "./dist/index.mjs"], {
    cwd: fileURLToPath(serverRoot),
    env: {
      ...process.env,
      NODE_ENV: "test",
      ADMIN_TEST_BYPASS: "1",
      PORT: String(port),
      APP_STORAGE_BACKEND: "local",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  await waitForServer().catch((error) => {
    throw new Error(`${error.message}\n${stderr}`);
  });
});

after(async () => {
  for (const id of createdAssetIds) {
    await request("DELETE", `/admin/media/${id}`, { confirm: true }).catch(() => {});
  }
  await stopChild(child);
  if (clipDir) rmSync(clipDir, { recursive: true, force: true });
});

describe("site settings API", { concurrency: false }, () => {
test("public site settings expose the seeded homepage and seed-guide defaults", async () => {
  const data = assertStatus(await request("GET", "/site-settings"), 200);
  assert.equal(data.homepage.heroEyebrow, "Western Australia's");
  assert.equal(data.homepage.heroHeading, "Pasture Seed Specialists");
  assert.match(data.homepage.heroBody, /\{productCount\}/);
  assert.match(data.homepage.aboutBody, /Irwin Hunter/);
  assert.deepEqual(data.homepage.bestSellerSlugs, []);
  assert.equal(data.homepage.heroSlideshow, false);
  assert.equal(data.homepage.heroImages.length, 1);
  assert.equal(data.seedGuide.navTitle, "Seed Guide 2026");
  assert.equal(data.seedGuide.pdfPublicUrl, "/IH-Seeds-2026-Pasture-Seed-Guide.pdf");
  assert.equal(data.about.heroEyebrow, "About IH Seeds");
  assert.equal(data.about.heroHeadingEmphasis, "since 1966");
  assert.equal(data.about.values.length, 3);
  assert.match(data.about.storyParagraphs.join(" "), /\{productCount\}/);
  assert.equal(data.company.legalName, "Irwin Hunter & Co");
  assert.equal(data.company.tradingName, "IH Seeds");
  assert.equal(data.company.phone, "");
  assert.equal(data.company.email, "info@irwinhunter.com.au");
});

test("admin can persist homepage copy and invalid best-seller slugs", async () => {
  const current = assertStatus(await request("GET", "/admin/site-settings"), 200);
  const saved = assertStatus(await request("PUT", "/admin/site-settings", {
    homepage: {
      ...current.homepage,
      heroEyebrow: "Test region",
      heroHeading: "Test specialists",
      aboutBody: "Edited About Us blurb for the home page.",
      bestSellerSlugs: ["not-a-real-product", "also-missing"],
    },
    seedGuide: {
      navTitle: current.seedGuide.navTitle,
      cardHeading: current.seedGuide.cardHeading,
      cardButtonLabel: current.seedGuide.cardButtonLabel,
      cardImageSrc: current.seedGuide.cardImageSrc,
      cardImageAssetId: current.seedGuide.cardImageAssetId,
      pageTitle: current.seedGuide.pageTitle,
      pageIntro: current.seedGuide.pageIntro,
      pageButtonLabel: current.seedGuide.pageButtonLabel,
    },
  }), 200);
  assert.equal(saved.homepage.heroEyebrow, "Test region");
  assert.equal(saved.homepage.heroHeading, "Test specialists");
  assert.equal(saved.homepage.aboutBody, "Edited About Us blurb for the home page.");
  assert.deepEqual(saved.homepage.bestSellerSlugs, ["not-a-real-product", "also-missing"]);
  const publicSettings = assertStatus(await request("GET", "/site-settings"), 200);
  assert.deepEqual(publicSettings.homepage.bestSellerSlugs, ["not-a-real-product", "also-missing"]);
});

test("seed-guide PDF upload rejects non-PDF and oversized files, then stores a valid PDF", async () => {
  const current = assertStatus(await request("GET", "/admin/site-settings"), 200);
  const notPdf = await request("POST", "/admin/site-settings/seed-guide-pdf", {
    filename: "notes.txt",
    data: Buffer.from("hello").toString("base64"),
  });
  assert.equal(notPdf.response.status, 400);
  assert.match(JSON.stringify(notPdf.data), /not a PDF/i);

  const oversized = Buffer.concat([Buffer.from("%PDF"), Buffer.alloc((15 * 1024 * 1024) + 1, 65)]);
  const tooBig = await request("POST", "/admin/site-settings/seed-guide-pdf", {
    filename: "huge.pdf",
    data: oversized.toString("base64"),
  });
  assert.equal(tooBig.response.status, 400);
  assert.match(JSON.stringify(tooBig.data), /15 MB/i);

  const uploaded = assertStatus(await request("POST", "/admin/site-settings/seed-guide-pdf", {
    filename: `guide-${testRunId}.pdf`,
    data: MINI_PDF.toString("base64"),
  }), 200);
  assert.equal(uploaded.seedGuide.pdfFilename, `guide-${testRunId}.pdf`);
  assert.equal(uploaded.seedGuide.pdfPublicUrl, "/api/site/seed-guide.pdf");
  const pdf = await request("GET", "/site/seed-guide.pdf");
  assert.equal(pdf.response.status, 200);
  assert.equal(pdf.response.headers.get("content-type"), "application/pdf");
  assert.ok(pdf.buffer.subarray(0, 4).equals(Buffer.from("%PDF")));

  const preserved = assertStatus(await request("PUT", "/admin/site-settings", {
    homepage: current.homepage,
    seedGuide: {
      navTitle: "Seed Guide test",
      cardHeading: current.seedGuide.cardHeading,
      cardButtonLabel: current.seedGuide.cardButtonLabel,
      cardImageSrc: current.seedGuide.cardImageSrc,
      cardImageAssetId: current.seedGuide.cardImageAssetId,
      pageTitle: current.seedGuide.pageTitle,
      pageIntro: current.seedGuide.pageIntro,
      pageButtonLabel: current.seedGuide.pageButtonLabel,
    },
  }), 200);
  assert.equal(preserved.seedGuide.navTitle, "Seed Guide test");
  assert.equal(preserved.seedGuide.pdfPublicUrl, "/api/site/seed-guide.pdf");
});

test("saving homepage and seed-guide images creates published static media references", async () => {
  const hero = await uploadPng(`hero-${testRunId}.png`);
  const card = await uploadPng(`card-${testRunId}.png`, PNG_RED_1X1);
  const current = assertStatus(await request("GET", "/admin/site-settings"), 200);
  const saved = assertStatus(await request("PUT", "/admin/site-settings", {
    homepage: {
      ...current.homepage,
      heroImageSrc: `/api/media/${hero.id}`,
      heroImageAssetId: hero.id,
      heroImages: [{ src: `/api/media/${hero.id}`, assetId: hero.id }],
    },
    seedGuide: {
      navTitle: current.seedGuide.navTitle,
      cardHeading: current.seedGuide.cardHeading,
      cardButtonLabel: current.seedGuide.cardButtonLabel,
      cardImageSrc: `/api/media/${card.id}`,
      cardImageAssetId: card.id,
      pageTitle: current.seedGuide.pageTitle,
      pageIntro: current.seedGuide.pageIntro,
      pageButtonLabel: current.seedGuide.pageButtonLabel,
    },
  }), 200);
  assert.equal(saved.homepage.heroImageAssetId, hero.id);
  assert.equal(saved.seedGuide.cardImageAssetId, card.id);

  const heroDetail = assertStatus(await request("GET", `/admin/media/${hero.id}`), 200);
  const heroUsage = heroDetail.usages.find((item) => item.ownerType === "static" && item.ownerId === "homepage");
  assert.ok(heroUsage);
  assert.equal(heroUsage.usageState, "Published");
  const publicHero = await request("GET", `/media/${hero.id}`);
  assert.equal(publicHero.response.status, 200);

  const cardDetail = assertStatus(await request("GET", `/admin/media/${card.id}`), 200);
  const cardUsage = cardDetail.usages.find((item) => item.ownerType === "static" && item.ownerId === "seed-guide");
  assert.ok(cardUsage);
  assert.equal(cardUsage.usageState, "Published");
});

test("admin can persist multiple homepage hero photos and a slideshow flag", async () => {
  const first = await uploadPng(`hero-a-${testRunId}.png`, PNG_BLUE_1X1);
  const second = await uploadPng(`hero-b-${testRunId}.png`, PNG_GREEN_1X1);
  const current = assertStatus(await request("GET", "/admin/site-settings"), 200);
  const saved = assertStatus(await request("PUT", "/admin/site-settings", {
    homepage: {
      ...current.homepage,
      heroImages: [
        { src: `/api/media/${first.id}`, assetId: first.id },
        { src: `/api/media/${second.id}`, assetId: second.id },
      ],
      heroSlideshow: true,
    },
    seedGuide: {
      navTitle: current.seedGuide.navTitle,
      cardHeading: current.seedGuide.cardHeading,
      cardButtonLabel: current.seedGuide.cardButtonLabel,
      cardImageSrc: current.seedGuide.cardImageSrc,
      cardImageAssetId: current.seedGuide.cardImageAssetId,
      pageTitle: current.seedGuide.pageTitle,
      pageIntro: current.seedGuide.pageIntro,
      pageButtonLabel: current.seedGuide.pageButtonLabel,
    },
  }), 200);
  assert.equal(saved.homepage.heroSlideshow, true);
  assert.equal(saved.homepage.heroImageAssetId, first.id);
  assert.deepEqual(saved.homepage.heroImages, [
    { src: `/api/media/${first.id}`, assetId: first.id },
    { src: `/api/media/${second.id}`, assetId: second.id },
  ]);
  const publicSettings = assertStatus(await request("GET", "/site-settings"), 200);
  assert.equal(publicSettings.homepage.heroSlideshow, true);
  assert.equal(publicSettings.homepage.heroImages.length, 2);

  const firstDetail = assertStatus(await request("GET", `/admin/media/${first.id}`), 200);
  const secondDetail = assertStatus(await request("GET", `/admin/media/${second.id}`), 200);
  assert.ok(firstDetail.usages.find((item) => item.ownerType === "static" && item.ownerId === "homepage"));
  assert.ok(secondDetail.usages.find((item) => item.ownerType === "static" && item.ownerId === "homepage"));
});

test("admin can persist About us copy and hero image without clearing homepage settings", async () => {
  const photo = await uploadPng(`about-${testRunId}.png`, PNG_WHITE_1X1);
  const current = assertStatus(await request("GET", "/admin/site-settings"), 200);
  const saved = assertStatus(await request("PUT", "/admin/site-settings", {
    homepage: current.homepage,
    seedGuide: {
      navTitle: current.seedGuide.navTitle,
      cardHeading: current.seedGuide.cardHeading,
      cardButtonLabel: current.seedGuide.cardButtonLabel,
      cardImageSrc: current.seedGuide.cardImageSrc,
      cardImageAssetId: current.seedGuide.cardImageAssetId,
      pageTitle: current.seedGuide.pageTitle,
      pageIntro: current.seedGuide.pageIntro,
      pageButtonLabel: current.seedGuide.pageButtonLabel,
    },
    about: {
      ...current.about,
      heroHeading: "Edited family owned,",
      heroHeadingEmphasis: "since testing",
      heroImageSrc: `/api/media/${photo.id}`,
      heroImageAssetId: photo.id,
      values: [
        { title: "Regional expertise", body: "Edited regional copy." },
        current.about.values[1],
        current.about.values[2],
      ],
    },
  }), 200);
  assert.equal(saved.about.heroHeading, "Edited family owned,");
  assert.equal(saved.about.heroHeadingEmphasis, "since testing");
  assert.equal(saved.about.heroImageAssetId, photo.id);
  assert.equal(saved.about.values[0].body, "Edited regional copy.");
  assert.equal(saved.homepage.heroHeading, current.homepage.heroHeading);

  const publicSettings = assertStatus(await request("GET", "/site-settings"), 200);
  assert.equal(publicSettings.about.heroHeadingEmphasis, "since testing");

  const detail = assertStatus(await request("GET", `/admin/media/${photo.id}`), 200);
  const usage = detail.usages.find((item) => item.ownerType === "static" && item.ownerId === "about");
  assert.ok(usage);
  assert.equal(usage.usageState, "Published");
  assert.equal(usage.editPath, "/admin/site-settings/about");
});

test("admin can persist company contact details without clearing homepage settings", async () => {
  const current = assertStatus(await request("GET", "/admin/site-settings"), 200);
  const saved = assertStatus(await request("PUT", "/admin/site-settings", {
    homepage: current.homepage,
    seedGuide: {
      navTitle: current.seedGuide.navTitle,
      cardHeading: current.seedGuide.cardHeading,
      cardButtonLabel: current.seedGuide.cardButtonLabel,
      cardImageSrc: current.seedGuide.cardImageSrc,
      cardImageAssetId: current.seedGuide.cardImageAssetId,
      pageTitle: current.seedGuide.pageTitle,
      pageIntro: current.seedGuide.pageIntro,
      pageButtonLabel: current.seedGuide.pageButtonLabel,
    },
    company: {
      legalName: "Irwin Hunter & Co",
      tradingName: "IH Seeds",
      phone: "(08) 9381 2345",
      email: "office@irwinhunter.com.au",
      address: "Unit 5, 75 Robinson Avenue, Belmont, WA 6104",
      officeHours: "Monday to Friday, 8am–5pm AWST",
      abn: "12 345 678 901",
    },
  }), 200);
  assert.equal(saved.company.phone, "(08) 9381 2345");
  assert.equal(saved.company.email, "office@irwinhunter.com.au");
  assert.equal(saved.company.abn, "12 345 678 901");
  assert.equal(saved.homepage.heroHeading, current.homepage.heroHeading);

  const homepageOnly = assertStatus(await request("PUT", "/admin/site-settings", {
    homepage: {
      ...current.homepage,
      heroHeading: current.homepage.heroHeading,
    },
    seedGuide: {
      navTitle: current.seedGuide.navTitle,
      cardHeading: current.seedGuide.cardHeading,
      cardButtonLabel: current.seedGuide.cardButtonLabel,
      cardImageSrc: current.seedGuide.cardImageSrc,
      cardImageAssetId: current.seedGuide.cardImageAssetId,
      pageTitle: current.seedGuide.pageTitle,
      pageIntro: current.seedGuide.pageIntro,
      pageButtonLabel: current.seedGuide.pageButtonLabel,
    },
  }), 200);
  assert.equal(homepageOnly.company.phone, "(08) 9381 2345");
  assert.equal(homepageOnly.company.abn, "12 345 678 901");

  const publicSettings = assertStatus(await request("GET", "/site-settings"), 200);
  assert.equal(publicSettings.company.phone, "(08) 9381 2345");
});

test("hero video upload rejects non-video and over-length clips", async () => {
  const notVideo = await request("PUT", "/admin/site-settings/hero-video", Buffer.from("%PDF-1.4 definitely not video"), "video/mp4");
  assert.equal(notVideo.response.status, 400);
  assert.match(JSON.stringify(notVideo.data), /MP4, MOV, or WebM/);

  if (!ffmpegPath) return;
  const tooLong = await request("PUT", "/admin/site-settings/hero-video", renderClip("long.mp4", "testsrc=size=160x120:rate=10:duration=31"), "video/mp4");
  assert.equal(tooLong.response.status, 400);
  assert.match(JSON.stringify(tooLong.data), /30 seconds or shorter/);
});

test("hero video upload transcodes the clip, serves it with byte ranges, and cleans up when removed", { skip: !ffmpegPath && "ffmpeg binary unavailable" }, async () => {
  const clip = renderClip("short.mp4", "testsrc=size=640x360:rate=50:duration=2");
  const uploaded = await fetch(`${baseUrl}/api/admin/site-settings/hero-video`, {
    method: "PUT",
    headers: { "content-type": "video/mp4", "x-filename": `paddock-${testRunId}.mp4` },
    body: clip,
  });
  const uploadedText = await uploaded.text();
  assert.equal(uploaded.status, 201, uploadedText);
  const slide = JSON.parse(uploadedText);
  assert.equal(slide.kind, "video");
  assert.equal(slide.assetId, null);
  assert.match(slide.src, /^\/api\/site\/hero-videos\/[a-f0-9-]{36}\.mp4$/);
  assert.match(slide.posterSrc, /^\/api\/site\/hero-videos\/[a-f0-9-]{36}\.webp$/);
  assert.ok(slide.durationSeconds > 1 && slide.durationSeconds <= 2.5, `duration ${slide.durationSeconds}`);

  const full = await fetch(`${baseUrl}${slide.src}`);
  assert.equal(full.status, 200);
  assert.equal(full.headers.get("content-type"), "video/mp4");
  assert.equal(full.headers.get("accept-ranges"), "bytes");
  const total = Number(full.headers.get("content-length"));
  const fullBytes = Buffer.from(await full.arrayBuffer());
  assert.equal(fullBytes.length, total);
  assert.equal(fullBytes.subarray(4, 8).toString("latin1"), "ftyp");

  const partial = await fetch(`${baseUrl}${slide.src}`, { headers: { range: "bytes=0-99" } });
  assert.equal(partial.status, 206);
  assert.equal(partial.headers.get("content-range"), `bytes 0-99/${total}`);
  assert.equal(Buffer.from(await partial.arrayBuffer()).length, 100);

  const tail = await fetch(`${baseUrl}${slide.src}`, { headers: { range: `bytes=${total - 10}-` } });
  assert.equal(tail.status, 206);
  assert.equal(Buffer.from(await tail.arrayBuffer()).length, 10);

  const outOfRange = await fetch(`${baseUrl}${slide.src}`, { headers: { range: `bytes=${total + 5}-` } });
  assert.equal(outOfRange.status, 416);

  const poster = await fetch(`${baseUrl}${slide.posterSrc}`);
  assert.equal(poster.status, 200);
  assert.equal(poster.headers.get("content-type"), "image/webp");
  assert.equal(Buffer.from(await poster.arrayBuffer()).subarray(8, 12).toString(), "WEBP");

  const current = assertStatus(await request("GET", "/admin/site-settings"), 200);
  const seedGuide = {
    navTitle: current.seedGuide.navTitle,
    cardHeading: current.seedGuide.cardHeading,
    cardButtonLabel: current.seedGuide.cardButtonLabel,
    cardImageSrc: current.seedGuide.cardImageSrc,
    cardImageAssetId: current.seedGuide.cardImageAssetId,
    pageTitle: current.seedGuide.pageTitle,
    pageIntro: current.seedGuide.pageIntro,
    pageButtonLabel: current.seedGuide.pageButtonLabel,
  };
  const photo = current.homepage.heroImages[0];
  const saved = assertStatus(await request("PUT", "/admin/site-settings", {
    homepage: { ...current.homepage, heroImages: [photo, slide], heroSlideshow: true },
    seedGuide,
  }), 200);
  assert.equal(saved.homepage.heroImages.length, 2);
  assert.equal(saved.homepage.heroSlideshow, true);
  assert.deepEqual(saved.homepage.heroImages[1], slide);
  const publicSettings = assertStatus(await request("GET", "/site-settings"), 200);
  assert.equal(publicSettings.homepage.heroImages[1].kind, "video");
  assert.equal(publicSettings.homepage.heroImages[1].posterSrc, slide.posterSrc);

  // Removing the slide from the homepage deletes the stored clip and poster.
  assertStatus(await request("PUT", "/admin/site-settings", {
    homepage: { ...current.homepage, heroImages: [photo], heroSlideshow: false },
    seedGuide,
  }), 200);
  assert.equal((await fetch(`${baseUrl}${slide.src}`)).status, 404);
  assert.equal((await fetch(`${baseUrl}${slide.posterSrc}`)).status, 404);
  assert.equal((await fetch(`${baseUrl}/api/site/hero-videos/%2e%2e%2f%2e%2e%2fseed-guide.pdf`)).status, 404);
});
});
