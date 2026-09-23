import type { CatalogueArticle, CatalogueCategory, CatalogueProduct } from "./catalogue";
import { productPageHeading } from "./catalogue";
import { categoryPublicPath, productPublicPath } from "./catalogue-paths";
import { getProductQuickFacts } from "./product-quick-facts";

export type SearchKind = "product" | "category" | "article";

export type SearchTextPart = {
  text: string;
  match: boolean;
};

export type SearchHit = {
  id: string;
  kind: SearchKind;
  title: SearchTextPart[];
  href: string;
  snippet: SearchTextPart[];
};

type FieldWeight = "title" | "body";

type SearchField = {
  text: string;
  weight: FieldWeight;
};

export type SearchDocument = {
  id: string;
  kind: SearchKind;
  title: string;
  href: string;
  fields: SearchField[];
};

const RESULT_LIMIT = 20;
const SNIPPET_WIDTH = 120;
const TITLE_PHRASE = 300;
const BODY_PHRASE = 200;
const TITLE_WORDS = 120;
const BODY_WORDS = 60;

type Token = { value: string; start: number; end: number };

export function buildSearchDocuments(input: {
  products: CatalogueProduct[];
  categories: CatalogueCategory[];
  articles: CatalogueArticle[];
}): SearchDocument[] {
  const documents: SearchDocument[] = [];
  for (const product of input.products) {
    documents.push(productDocument(product, input.categories));
  }
  for (const category of input.categories) {
    const document = categoryDocument(category);
    if (document) documents.push(document);
  }
  for (const article of input.articles) {
    documents.push(articleDocument(article));
  }
  return documents;
}

export function searchDocuments(query: string, documents: SearchDocument[]): SearchHit[] {
  const queryWords = tokenize(query).map((token) => token.value);
  if (!queryWords.length) return [];

  const ranked = documents.flatMap((document) => {
    const match = bestMatch(document, queryWords);
    if (!match) return [];
    return [{
      id: document.id,
      kind: document.kind,
      title: document.title,
      href: document.href,
      snippet: snippetAround(match.field.text, match.start, match.end),
      score: match.score,
    }];
  });

  ranked.sort((first, second) =>
    second.score - first.score
    || groupRank(first.kind) - groupRank(second.kind)
    || first.title.localeCompare(second.title));

  return ranked.slice(0, RESULT_LIMIT).map((hit) => ({
    id: hit.id,
    kind: hit.kind,
    href: hit.href,
    title: highlightText(hit.title, queryWords),
    snippet: highlightText(hit.snippet, queryWords),
  }));
}

function productDocument(product: CatalogueProduct, categories: CatalogueCategory[]): SearchDocument {
  const details = product.details;
  const fields: SearchField[] = [];
  addField(fields, "title", product.name);
  addField(fields, "title", productPageHeading(product));
  addField(fields, "body", details.tagline);
  addField(fields, "body", details.blurb);
  addField(fields, "body", details.description);
  const attributes = (details.keyAttributes ?? []).map((attribute) => attribute.trim()).filter(Boolean);
  addField(fields, "body", attributes.join(", "));
  for (const component of details.components ?? []) {
    addField(fields, "body", [component.speciesName, component.description, component.note].filter(Boolean).join(" "));
  }
  for (const fact of getProductQuickFacts(product)) {
    addField(fields, "body", `${fact.label}: ${fact.value}`);
  }
  addField(fields, "body", details.grazingManagementNotes);
  addField(fields, "body", details.diseasePestResistance);
  addField(fields, "body", details.standLifeNotes);
  for (const faq of completeFaqs(details.faqs, 10)) {
    addField(fields, "title", faq.question);
    addField(fields, "body", faq.answer);
  }
  return {
    id: `product:${product.id}`,
    kind: "product",
    title: productPageHeading(product),
    href: productPublicPath(product, categories),
    fields,
  };
}

function categoryDocument(category: CatalogueCategory): SearchDocument | null {
  if (category.parentId !== null || !category.active) return null;
  const faqs = completeFaqs(category.faqs, 20);
  const lead = category.lead?.trim() ?? "";
  if (!lead && faqs.length === 0) return null;
  const heading = category.pageHeading.trim() || `${category.name} Seed`;
  const fields: SearchField[] = [];
  addField(fields, "title", category.name);
  addField(fields, "title", heading);
  addField(fields, "body", lead);
  for (const faq of faqs) {
    addField(fields, "title", faq.question);
    addField(fields, "body", faq.answer);
  }
  return {
    id: `category:${category.id}`,
    kind: "category",
    title: heading,
    href: categoryPublicPath(category),
    fields,
  };
}

function articleDocument(article: CatalogueArticle): SearchDocument {
  const fields: SearchField[] = [];
  addField(fields, "title", article.title);
  addField(fields, "body", article.tags.map((tag) => tag.trim()).filter(Boolean).join(" "));
  addField(fields, "body", article.excerpt);
  addField(fields, "body", plainText(article.body));
  return {
    id: `article:${article.id}`,
    kind: "article",
    title: article.title,
    href: `/resources/${article.slug}`,
    fields,
  };
}

function completeFaqs(
  faqs: Array<{ question?: string; answer?: string }> | undefined,
  limit: number,
) {
  return (faqs ?? [])
    .map((faq) => ({ question: faq.question?.trim() ?? "", answer: faq.answer?.trim() ?? "" }))
    .filter((faq) => faq.question && faq.answer)
    .slice(0, limit);
}

function addField(fields: SearchField[], weight: FieldWeight, text: string | null | undefined) {
  const value = text?.replace(/\s+/g, " ").trim() ?? "";
  if (!value) return;
  const folded = value.toLocaleLowerCase();
  if (fields.some((field) => field.weight === weight && field.text.toLocaleLowerCase() === folded)) return;
  fields.push({ text: value, weight });
}

function plainText(value: string) {
  return decodeEntities(value)
    .replace(/\r\n/g, "\n")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_~`]+/g, " ");
}

function decodeEntities(value: string) {
  let current = value;
  for (let pass = 0; pass < 2; pass += 1) {
    const next = current
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, "\"")
      .replace(/&apos;/gi, "'")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&#(\d+);/g, (_match, code: string) => characterFromCode(Number(code)))
      .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => characterFromCode(Number.parseInt(code, 16)));
    if (next === current) break;
    current = next;
  }
  return current;
}

function characterFromCode(code: number) {
  if (!Number.isFinite(code) || code < 1 || code > 0x10ffff) return "";
  return String.fromCodePoint(code);
}

function groupRank(kind: SearchKind) {
  return kind === "article" ? 1 : 0;
}

type FieldMatch = {
  score: number;
  field: SearchField;
  start: number;
  end: number;
};

function bestMatch(document: SearchDocument, queryWords: string[]): FieldMatch | null {
  let best: FieldMatch | null = null;
  for (const field of document.fields) {
    const tokens = tokenize(field.text);
    const words = tokens.map((token) => token.value);
    const phraseAt = findPhrase(words, queryWords);
    if (phraseAt != null) {
      const score = field.weight === "title" ? TITLE_PHRASE : BODY_PHRASE;
      best = prefer(best, {
        score,
        field,
        start: tokens[phraseAt].start,
        end: tokens[phraseAt + queryWords.length - 1].end,
      });
      continue;
    }
    if (!coversWords(words, queryWords)) continue;
    const first = words.findIndex((word) => queryWords.some((queryWord) => tokensMatch(queryWord, word)));
    const score = field.weight === "title" ? TITLE_WORDS : BODY_WORDS;
    best = prefer(best, {
      score,
      field,
      start: tokens[first].start,
      end: tokens[first].end,
    });
  }
  return best;
}

function prefer(current: FieldMatch | null, next: FieldMatch) {
  if (!current || next.score > current.score) return next;
  return current;
}

function findPhrase(words: string[], queryWords: string[]) {
  if (!queryWords.length || queryWords.length > words.length) return null;
  for (let start = 0; start <= words.length - queryWords.length; start += 1) {
    const matches = queryWords.every((queryWord, offset) => tokensMatch(queryWord, words[start + offset]));
    if (matches) return start;
  }
  return null;
}

function coversWords(words: string[], queryWords: string[]) {
  const used = new Set<number>();
  for (const queryWord of queryWords) {
    const index = words.findIndex((word, wordIndex) => !used.has(wordIndex) && tokensMatch(queryWord, word));
    if (index === -1) return false;
    used.add(index);
  }
  return true;
}

function tokensMatch(queryToken: string, fieldToken: string) {
  if (queryToken === fieldToken) return true;
  if (queryToken.length <= 3 || fieldToken.length <= 3) return false;
  if (withinOneEdit(queryToken, fieldToken)) return true;
  if (queryToken.length >= fieldToken.length) return false;
  const prefix = fieldToken.slice(0, queryToken.length);
  if (queryToken === prefix) return true;
  return queryToken.length >= 5 && withinOneEdit(queryToken, prefix);
}

function withinOneEdit(left: string, right: string) {
  const difference = left.length - right.length;
  if (difference < -1 || difference > 1) return false;
  let edits = 0;
  let leftIndex = 0;
  let rightIndex = 0;
  while (leftIndex < left.length && rightIndex < right.length) {
    if (left[leftIndex] === right[rightIndex]) {
      leftIndex += 1;
      rightIndex += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (left.length === right.length) {
      leftIndex += 1;
      rightIndex += 1;
    } else if (left.length > right.length) {
      leftIndex += 1;
    } else {
      rightIndex += 1;
    }
  }
  if (leftIndex < left.length || rightIndex < right.length) edits += 1;
  return edits <= 1;
}

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let value = "";
  let start = -1;
  for (let index = 0; index < text.length; index += 1) {
    const folded = foldChar(text[index]);
    if (folded) {
      if (!value) start = index;
      value += folded;
      continue;
    }
    if (value) {
      tokens.push({ value, start, end: index });
      value = "";
      start = -1;
    }
  }
  if (value) tokens.push({ value, start, end: text.length });
  return tokens;
}

function foldChar(char: string) {
  const folded = char.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  return /^[a-z0-9]+$/.test(folded) ? folded : "";
}

function matchedFoldedLength(queryWord: string, fieldToken: string) {
  if (!tokensMatch(queryWord, fieldToken)) return 0;
  if (queryWord.length >= fieldToken.length || withinOneEdit(queryWord, fieldToken)) return fieldToken.length;
  return queryWord.length;
}

function endAtFoldedLength(text: string, start: number, end: number, foldedLength: number) {
  let counted = 0;
  for (let index = start; index < end; index += 1) {
    counted += foldChar(text[index]).length;
    if (counted >= foldedLength) return index + 1;
  }
  return end;
}

function highlightText(text: string, queryWords: string[]): SearchTextPart[] {
  const tokens = tokenize(text);
  if (!tokens.length) return text ? [{ text, match: false }] : [];
  const parts: SearchTextPart[] = [];
  let cursor = 0;
  for (const token of tokens) {
    if (token.start > cursor) parts.push({ text: text.slice(cursor, token.start), match: false });
    const foldedLength = queryWords.reduce((longest, queryWord) => Math.max(longest, matchedFoldedLength(queryWord, token.value)), 0);
    if (foldedLength === 0) {
      parts.push({ text: text.slice(token.start, token.end), match: false });
    } else {
      const matchEnd = endAtFoldedLength(text, token.start, token.end, foldedLength);
      parts.push({ text: text.slice(token.start, matchEnd), match: true });
      if (matchEnd < token.end) parts.push({ text: text.slice(matchEnd, token.end), match: false });
    }
    cursor = token.end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), match: false });
  const merged: SearchTextPart[] = [];
  for (const part of parts) {
    const previous = merged[merged.length - 1];
    if (previous && previous.match === part.match) previous.text += part.text;
    else merged.push({ ...part });
  }
  return merged;
}

function snippetAround(text: string, start: number, end: number) {
  const matchLength = Math.min(Math.max(end - start, 0), SNIPPET_WIDTH);
  let from = Math.max(0, start - Math.floor((SNIPPET_WIDTH - matchLength) / 2));
  let to = Math.min(text.length, from + SNIPPET_WIDTH);
  if (to - from < SNIPPET_WIDTH) from = Math.max(0, to - SNIPPET_WIDTH);
  let slice = text.slice(from, to).replace(/\s+/g, " ").trim();
  if (from > 0) slice = `…${slice}`;
  if (to < text.length) slice = `${slice}…`;
  return slice;
}
