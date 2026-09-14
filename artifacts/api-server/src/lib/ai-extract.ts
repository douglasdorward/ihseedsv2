import { promptFieldsForCategory } from "./ai-patch";

export type LlmExtractInput = {
  productName?: string;
  category: string;
  existingProduct: boolean;
  currentProduct: unknown;
  pdfText: string;
  images?: Array<{ mediaType: string; data: string }>;
};

function extractJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced?.[1] ?? text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return {};
  try {
    return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function stubPatchFromText(input: LlmExtractInput) {
  const lines = input.pdfText.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const first = lines[0] ?? "";
  const rainfall = input.pdfText.match(/(\d{3,4})\s*mm/i);
  const ph = input.pdfText.match(/pH\s*([0-9]+(?:\.[0-9]+)?)/i);
  const botanical = input.pdfText.match(/\b([A-Z][a-z]+ [a-z]+(?:\s[a-z]+)?)\b/);
  const ploidy = /\btetraploid\b/i.test(input.pdfText) ? "Tetraploid" : /\bdiploid\b/i.test(input.pdfText) ? "Diploid" : undefined;
  return {
    name: input.existingProduct ? undefined : first.slice(0, 160),
    details: {
      botanicalName: botanical?.[1],
      rainfallMinMm: rainfall ? Number(rainfall[1]) : undefined,
      soilPhMin: ph ? Number(ph[1]) : undefined,
      ploidy,
      tagline: first.slice(0, 60),
      blurb: lines.slice(0, 3).join(" ").slice(0, 600),
      description: input.pdfText.slice(0, 4000),
      keyAttributes: lines.slice(1, 6),
      seoTitle: first.slice(0, 70),
    },
  };
}

function anthropicConfig() {
  const apiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
  const baseUrl = (process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/+$/, "");
  return apiKey ? { apiKey, baseUrl } : null;
}

function openaiConfig() {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  const baseUrl = (process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
  return apiKey ? { apiKey, baseUrl } : null;
}

function extractionInstructions(input: LlmExtractInput) {
  const fields = promptFieldsForCategory(input.category, input.existingProduct);
  return [
    "You extract IH Seeds catalogue fields from a product tech sheet.",
    "Return JSON only. Use the API paths, grouped as { name?, category?, techSheet?, details: { botanicalName, rainfallMinMm, tagline, ... } }.",
    "Fill every editor tab you can from this document: Basics, Agronomy & fit, Category-specific, Content & publishing, and SEO.",
    "Selling (sale lines, stock codes, prices, availability) is never filled. Do not invent slugs, photos, or related products.",
    "Leave a field out when the document does not clearly state it. Do not guess.",
    "Use enumValues exactly when present (case may differ in the PDF; return the listed value).",
    "Sowing rates are an array of { context, min, max, unit }. Tolerances are [{ name, mild }]. FAQs are [{ question, answer }].",
    "Do not copy breeder, origin, supplier, licence, or internal notes into tagline, blurb, description, key attributes, FAQs, or SEO.",
    "Keep rainfall, pH, soils, sowing, tolerance, livestock, persistency, and similar facts in their structured fields instead of repeating them in description.",
    "Tagline is one short fragment, no full stop, max 60 characters. No ™ or ® in tagline or SEO.",
    "Description is 3-5 plain paragraphs covering the variety story, not a dump of the agronomy table.",
    `Product name: ${input.productName || "(unknown)"}. Category: ${input.category || "(unknown)"}.`,
    "Allowed fields by editor tab:",
    JSON.stringify(fields),
    "Current stored values (do not repeat private fields into public copy):",
    JSON.stringify(input.currentProduct ?? {}),
  ].join("\n");
}

async function completeWithAnthropic(input: LlmExtractInput) {
  const config = anthropicConfig();
  if (!config) return null;
  const content: unknown[] = [{ type: "text", text: `${extractionInstructions(input)}\n\nDocument text:\n${input.pdfText.slice(0, 80_000)}` }];
  for (const image of input.images ?? []) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: image.mediaType, data: image.data },
    });
  }
  const response = await fetch(`${config.baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.AI_EXTRACT_MODEL || "claude-sonnet-4-5",
      max_tokens: 8192,
      messages: [{ role: "user", content }],
    }),
  });
  if (!response.ok) throw new Error(`Anthropic extraction failed (${response.status})`);
  const body = await response.json() as { content?: Array<{ text?: string }> };
  return extractJson(body.content?.map((part) => part.text ?? "").join("\n") ?? "");
}

async function completeWithOpenAi(input: LlmExtractInput) {
  const config = openaiConfig();
  if (!config) return null;
  const content: unknown[] = [{ type: "text", text: `${extractionInstructions(input)}\n\nDocument text:\n${input.pdfText.slice(0, 80_000)}` }];
  for (const image of input.images ?? []) {
    content.push({
      type: "image_url",
      image_url: { url: `data:${image.mediaType};base64,${image.data}` },
    });
  }
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.AI_EXTRACT_MODEL || "gpt-4.1-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Return JSON only." },
        { role: "user", content },
      ],
      max_tokens: 8192,
    }),
  });
  if (!response.ok) throw new Error(`OpenAI extraction failed (${response.status})`);
  const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  return extractJson(body.choices?.[0]?.message?.content ?? "");
}

export function aiExtractConfigured() {
  return Boolean(process.env.AI_EXTRACT_STUB || anthropicConfig() || openaiConfig());
}

export async function proposeFieldsFromDocument(input: LlmExtractInput, stubPatch?: unknown) {
  if (process.env.AI_EXTRACT_STUB || stubPatch) {
    if (stubPatch && typeof stubPatch === "object") return stubPatch;
    return stubPatchFromText(input);
  }
  const anthropic = await completeWithAnthropic(input);
  if (anthropic) return anthropic;
  const openai = await completeWithOpenAi(input);
  if (openai) return openai;
  throw new Error("AI extraction is not configured. Set Replit AI Integrations or AI_EXTRACT_STUB.");
}
