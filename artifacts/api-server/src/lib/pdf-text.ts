import { inflateSync } from "node:zlib";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const execFileAsync = promisify(execFile);
const MIN_TEXT_CHARS = 80;

function unescapePdfString(value: string) {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\")
    .replace(/\\(\d{1,3})/g, (_match, octal: string) => String.fromCharCode(Number.parseInt(octal, 8)));
}

function stringsFromPdfSource(source: string) {
  const chunks: string[] = [];
  const literal = /\((?:\\.|[^\\)])*\)\s*Tj/g;
  for (const match of source.matchAll(literal)) {
    const inner = match[0].slice(1, match[0].lastIndexOf(")"));
    chunks.push(unescapePdfString(inner));
  }
  const arrayOp = /\[(.*?)\]\s*TJ/gs;
  for (const match of source.matchAll(arrayOp)) {
    const parts = [...match[1].matchAll(/\((?:\\.|[^\\)])*\)/g)].map((item) => unescapePdfString(item[0].slice(1, -1)));
    chunks.push(parts.join(""));
  }
  return chunks.join("\n");
}

function inflatePdfStreams(buffer: Buffer) {
  const parts: string[] = [];
  const latin = buffer.toString("latin1");
  const marker = /stream\r?\n/g;
  let match: RegExpExecArray | null;
  while ((match = marker.exec(latin))) {
    const start = match.index + match[0].length;
    const end = latin.indexOf("endstream", start);
    if (end < 0) break;
    const raw = Buffer.from(latin.slice(start, end), "latin1");
    const trimmed = raw[raw.length - 1] === 0x0a || raw[raw.length - 1] === 0x0d
      ? raw.subarray(0, raw[raw.length - 2] === 0x0d ? raw.length - 2 : raw.length - 1)
      : raw;
    try {
      parts.push(inflateSync(trimmed).toString("utf8"));
    } catch {
      parts.push(trimmed.toString("utf8"));
    }
    marker.lastIndex = end + 9;
  }
  return parts.join("\n");
}

function tidyExtractedText(value: string) {
  return value
    .replace(/\0/g, "")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function mutoolText(buffer: Buffer) {
  const directory = await mkdtemp(path.join(tmpdir(), "ih-pdf-"));
  const input = path.join(directory, "source.pdf");
  try {
    await writeFile(input, buffer);
    const { stdout } = await execFileAsync("mutool", ["draw", "-F", "txt", input], {
      timeout: 15_000,
      maxBuffer: 8 * 1024 * 1024,
    });
    return tidyExtractedText(stdout);
  } catch {
    return "";
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export async function renderPdfPagePngs(buffer: Buffer, maxPages = 3) {
  const directory = await mkdtemp(path.join(tmpdir(), "ih-pdf-pages-"));
  const input = path.join(directory, "source.pdf");
  const images: Buffer[] = [];
  try {
    await writeFile(input, buffer);
    await execFileAsync("mutool", ["draw", "-F", "png", "-o", path.join(directory, "page-%d.png"), input], {
      timeout: 20_000,
    });
    for (let page = 1; page <= maxPages; page += 1) {
      try {
        images.push(await readFile(path.join(directory, `page-${page}.png`)));
      } catch {
        break;
      }
    }
  } catch {
    return [];
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
  return images;
}

export async function extractPdfText(buffer: Buffer) {
  const inflated = inflatePdfStreams(buffer);
  const fromStreams = tidyExtractedText(stringsFromPdfSource(inflated) || inflated);
  const fromRaw = tidyExtractedText(stringsFromPdfSource(buffer.toString("latin1")));
  let text = fromStreams.length >= fromRaw.length ? fromStreams : fromRaw;
  if (text.length < MIN_TEXT_CHARS) {
    const fromMutool = await mutoolText(buffer);
    if (fromMutool.length > text.length) text = fromMutool;
  }
  return {
    text,
    scannedLikely: text.length < MIN_TEXT_CHARS,
  };
}
