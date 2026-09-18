import type { ReactNode } from "react";

function safeHref(href: string) {
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

function inlineMarkdown(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    if (match[1]) nodes.push(<strong key={`${keyPrefix}-b-${index}`}>{match[1]}</strong>);
    else if (match[2]) nodes.push(<em key={`${keyPrefix}-i-${index}`}>{match[2]}</em>);
    else {
      const href = safeHref(match[4] ?? "");
      if (href) nodes.push(<a key={`${keyPrefix}-a-${index}`} href={href}>{match[3]}</a>);
      else nodes.push(match[3] ?? "");
    }
    last = match.index + match[0].length;
    index += 1;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function renderBlock(block: string, index: number): ReactNode {
  const heading = block.match(/^(#{2,3})\s+(.+)$/);
  if (heading) {
    const Tag = heading[1] === "##" ? "h2" : "h3";
    return <Tag key={index}>{inlineMarkdown(heading[2] ?? "", `h-${index}`)}</Tag>;
  }
  if (block.startsWith("> ")) {
    return <blockquote key={index}>{inlineMarkdown(block.replace(/^>\s?/gm, ""), `q-${index}`)}</blockquote>;
  }
  const unordered = block.split("\n").every((line) => /^[-*]\s+/.test(line));
  if (unordered) {
    return (
      <ul key={index}>
        {block.split("\n").map((line, itemIndex) => (
          <li key={itemIndex}>{inlineMarkdown(line.replace(/^[-*]\s+/, ""), `ul-${index}-${itemIndex}`)}</li>
        ))}
      </ul>
    );
  }
  const ordered = block.split("\n").every((line) => /^\d+\.\s+/.test(line));
  if (ordered) {
    return (
      <ol key={index}>
        {block.split("\n").map((line, itemIndex) => (
          <li key={itemIndex}>{inlineMarkdown(line.replace(/^\d+\.\s+/, ""), `ol-${index}-${itemIndex}`)}</li>
        ))}
      </ol>
    );
  }
  return <p key={index}>{inlineMarkdown(block, `p-${index}`)}</p>;
}

function looksLikeHtml(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value.trim());
}

const ALLOWED_TAGS = new Set(["p", "h2", "h3", "strong", "b", "em", "i", "u", "a", "ul", "ol", "li", "blockquote", "br"]);
const RENAME_TAGS: Record<string, string> = { b: "strong", i: "em", h1: "h2", div: "p" };

function sanitizeArticleHtml(html: string) {
  const source = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "");
  let output = "";
  const stack: string[] = [];
  const token = /<\/?([a-zA-Z0-9]+)([^>]*)>|([^<]+)/g;
  let match: RegExpExecArray | null;
  const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const decode = (text: string) => text
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
  while ((match = token.exec(source))) {
    if (match[3] != null) {
      output += escape(decode(match[3]));
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
        if (open && open !== "br") output += `</${open}>`;
      }
      continue;
    }
    if (mapped === "br") {
      output += "<br>";
      continue;
    }
    if (mapped === "a") {
      const hrefMatch = (match[2] ?? "").match(/(?:^|\s)href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const href = safeHref(decode(hrefMatch?.[2] ?? hrefMatch?.[3] ?? hrefMatch?.[4] ?? ""));
      if (!href) continue;
      stack.push("a");
      output += `<a href="${escape(href)}">`;
      continue;
    }
    stack.push(mapped);
    output += `<${mapped}>`;
  }
  while (stack.length) {
    const open = stack.pop();
    if (open && open !== "br") output += `</${open}>`;
  }
  return output.trim();
}

export function ArticleMarkdown({ value }: { value: string }) {
  const trimmed = value.replace(/\r\n/g, "\n").trim();
  if (!trimmed) return null;
  if (looksLikeHtml(trimmed)) {
    const html = sanitizeArticleHtml(trimmed);
    return html ? <div className="article-body" dangerouslySetInnerHTML={{ __html: html }} /> : null;
  }
  const blocks = trimmed.split(/\n{2,}/).filter(Boolean);
  if (!blocks.length) return null;
  return <div className="article-body">{blocks.map((block, index) => renderBlock(block, index))}</div>;
}
