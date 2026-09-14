export type AiSuggestion = {
  path: string;
  label: string;
  tab: number;
  current: unknown;
  proposed: unknown;
  confidence: number;
  quote?: string;
};

export type AiExtractResponse = {
  item?: { id: number; fileUrl?: string; status: string; productId: number | null };
  suggestions: AiSuggestion[];
  warnings: string[];
  scanned: boolean;
  error?: string;
};

export function setFormPath(form: any, path: string, value: unknown) {
  const parts = path.split(".");
  if (parts.length === 1) return { ...form, [path]: value };
  if (parts[0] === "details" && parts.length === 2) {
    return { ...form, details: { ...form.details, [parts[1]]: value } };
  }
  return form;
}

export function applyAcceptedSuggestions(form: any, suggestions: Array<AiSuggestion & { accepted: boolean }>) {
  return suggestions.reduce((current, suggestion) => (
    suggestion.accepted ? setFormPath(current, suggestion.path, suggestion.proposed) : current
  ), form);
}

export function formatSuggestionValue(value: unknown) {
  if (value == null || value === "") return "(empty)";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    if (!value.length) return "(empty)";
    if (value.every((item) => typeof item === "string")) return value.filter(Boolean).join(" · ");
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that PDF."));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

export async function extractProductFromPdf(file: File, productId?: number, category?: string) {
  const data = await fileToBase64(file);
  const response = await fetch("/api/admin/ai/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      productId,
      category: category || undefined,
      files: [{ filename: file.name, data }],
    }),
  });
  const body = await response.json().catch(() => null) as AiExtractResponse | { error?: string } | null;
  if (!response.ok) {
    throw new Error(typeof body?.error === "string" ? body.error : `Extraction failed (${response.status})`);
  }
  return body as AiExtractResponse;
}

export async function fetchTechSheetItem(id: number) {
  const response = await fetch(`/api/admin/tech-sheets/${id}`);
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error ?? "Could not load that tech sheet.");
  return body as {
    id: number;
    filename: string;
    status: string;
    productId: number | null;
    fileUrl: string;
    warnings: string[];
    proposedPatch?: { suggestions?: AiSuggestion[]; warnings?: string[]; scanned?: boolean } | null;
  };
}
