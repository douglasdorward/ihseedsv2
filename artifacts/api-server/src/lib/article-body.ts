const ALLOWED_TAGS = new Set(["p", "h2", "h3", "strong", "b", "em", "i", "u", "a", "ul", "ol", "li", "blockquote", "br", "img"]);
const VOID_TAGS = new Set(["br", "img"]);
const RENAME_TAGS: Record<string, string> = { b: "strong", i: "em", h1: "h2", div: "p" };
const MEDIA_SRC = /^\/api\/(?:admin\/)?media\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/preview)?(?:\?.*)?$/i;

export function safeHref(href: string) {
  const value = href.trim();
  if (!value) return null;
  if (value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\")) return value;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function safeImageSrc(src: string) {
  const value = src.trim();
  const media = value.match(MEDIA_SRC);
  if (media) return `/api/media/${media[1].toLowerCase()}`;
  return safeHref(value);
}

export function articleBodyAssetIds(html: string) {
  const ids: string[] = [];
  const seen = new Set<string>();
  const matches = html.matchAll(/\/api\/(?:admin\/)?media\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi);
  for (const match of matches) {
    const id = match[1].toLowerCase();
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export function looksLikeHtml(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value.trim());
}

export function bodyHasText(value: string) {
  if (/<img\b/i.test(value)) return true;
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
    .length > 0;
}

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function decodeEntities(text: string) {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function attributeValue(attributes: string, name: string) {
  const match = attributes.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return match?.[2] ?? match?.[3] ?? match?.[4] ?? "";
}

export function sanitizeArticleHtml(html: string) {
  const source = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "");
  let output = "";
  const stack: string[] = [];
  const token = /<\/?([a-zA-Z0-9]+)([^>]*)>|([^<]+)/g;
  let match: RegExpExecArray | null;
  while ((match = token.exec(source))) {
    if (match[3] != null) {
      output += escapeHtml(decodeEntities(match[3]));
      continue;
    }
    const rawName = (match[1] ?? "").toLowerCase();
    const closing = match[0].startsWith("</");
    const mapped = RENAME_TAGS[rawName] ?? rawName;
    if (!ALLOWED_TAGS.has(mapped)) continue;
    if (closing) {
      const index = stack.lastIndexOf(mapped);
      if (index === -1) continue;
      while (stack.length > index) {
        const open = stack.pop();
        if (open && !VOID_TAGS.has(open)) output += `</${open}>`;
      }
      continue;
    }
    if (mapped === "img") {
      const src = safeImageSrc(decodeEntities(attributeValue(match[2] ?? "", "src")));
      if (!src) continue;
      const alt = decodeEntities(attributeValue(match[2] ?? "", "alt"));
      output += `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}">`;
      continue;
    }
    if (VOID_TAGS.has(mapped)) {
      output += `<${mapped}>`;
      continue;
    }
    if (mapped === "a") {
      const href = safeHref(decodeEntities(attributeValue(match[2] ?? "", "href")));
      if (!href) continue;
      stack.push("a");
      output += `<a href="${escapeHtml(href)}">`;
      continue;
    }
    stack.push(mapped);
    output += `<${mapped}>`;
  }
  while (stack.length) {
    const open = stack.pop();
    if (open && !VOID_TAGS.has(open)) output += `</${open}>`;
  }
  return output.replace(/(<p><\/p>)+/g, "").trim();
}

function inlineMarkdownToHtml(text: string) {
  const escaped = escapeHtml(text);
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_all, label: string, href: string) => {
      const safe = safeHref(href);
      return safe ? `<a href="${escapeHtml(safe)}">${label}</a>` : label;
    });
}

export function markdownToHtml(value: string) {
  const blocks = value.replace(/\r\n/g, "\n").trim().split(/\n{2,}/).filter(Boolean);
  return blocks.map((block) => {
    const heading = block.match(/^(#{2,3})\s+(.+)$/);
    if (heading) {
      const tag = heading[1] === "##" ? "h2" : "h3";
      return `<${tag}>${inlineMarkdownToHtml(heading[2] ?? "")}</${tag}>`;
    }
    if (block.startsWith("> ")) {
      return `<blockquote>${inlineMarkdownToHtml(block.replace(/^>\s?/gm, ""))}</blockquote>`;
    }
    const lines = block.split("\n");
    if (lines.every((line) => /^[-*]\s+/.test(line))) {
      return `<ul>${lines.map((line) => `<li>${inlineMarkdownToHtml(line.replace(/^[-*]\s+/, ""))}</li>`).join("")}</ul>`;
    }
    if (lines.every((line) => /^\d+\.\s+/.test(line))) {
      return `<ol>${lines.map((line) => `<li>${inlineMarkdownToHtml(line.replace(/^\d+\.\s+/, ""))}</li>`).join("")}</ol>`;
    }
    return `<p>${inlineMarkdownToHtml(block).replace(/\n/g, "<br>")}</p>`;
  }).join("");
}

export function articleImageMarkup(src: string, alt: string) {
  const safeSrc = safeImageSrc(src);
  if (!safeSrc) return "";
  return `<p><img src="${escapeHtml(safeSrc)}" alt="${escapeHtml(alt.trim())}"></p>`;
}

export function normalizeArticleBody(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const html = looksLikeHtml(trimmed) ? sanitizeArticleHtml(trimmed) : sanitizeArticleHtml(markdownToHtml(trimmed));
  return bodyHasText(html) ? html : "";
}
