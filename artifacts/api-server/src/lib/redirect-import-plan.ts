import { createHash } from "node:crypto";
import { parseCsv } from "./csv";
import { normalizePublicPath } from "./product-path";

export const REDIRECT_IMPORT_HEADERS = ["from_path", "to_path"] as const;
export const REDIRECT_IMPORT_TEMPLATE = `${REDIRECT_IMPORT_HEADERS.join(",")}\n`;
export const REDIRECT_IMPORT_MAX_ROWS = 5000;
const PATH_MAX = 500;
const PLANNED_CHANGE_PREVIEW = 100;
const LOOP_HOP_LIMIT = 20;

export type RedirectImportIssue = { row: number; column: string; problem: string };

export type RedirectImportReport = {
  token: string;
  rows: number;
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  issues: RedirectImportIssue[];
  plannedChanges: string[];
};

/** What the importer needs to know about the redirects already in place. */
export type RedirectImportContext = {
  /** fromPath -> toPath for every stored redirect. */
  existing: ReadonlyMap<string, string>;
  /** Paths owned by a product or article editor's legacy URL field. */
  managed: ReadonlySet<string>;
  /** Public pages for products that are currently live. */
  liveProductPaths: ReadonlySet<string>;
};

export type PlannedRedirect = { row: number; fromPath: string; toPath: string; kind: "create" | "update" };

const RESERVED_PREFIXES = ["/api", "/admin", "/_next"];

function isReserved(path: string) {
  return RESERVED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

type PathResult = { path: string; problem?: undefined } | { path?: undefined; problem: string };

/**
 * Accepts `/old/page`, `/old/page/` or a full URL on irwinhunter.com.au and
 * returns the stored form: percent-encoded pathname, no trailing slash. Only
 * the destination may carry a query string, because lookups match the path.
 */
export function normalizeRedirectPath(raw: string, role: "from" | "to"): PathResult {
  const value = raw.trim();
  if (!value) return { problem: role === "from" ? "from_path is required." : "to_path is required." };
  if (/\s/.test(value)) return { problem: "Paths cannot contain spaces. Encode them, for example %20." };

  let url: URL;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    try {
      url = new URL(value);
    } catch {
      return { problem: "That is not a valid URL." };
    }
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    if (!["http:", "https:"].includes(url.protocol) || hostname !== "irwinhunter.com.au" || url.username || url.password) {
      return { problem: "Use a path starting with / or a URL on irwinhunter.com.au. Other websites are not supported." };
    }
  } else if (value.startsWith("/") && !value.startsWith("//")) {
    try {
      url = new URL(value, "https://irwinhunter.com.au");
    } catch {
      return { problem: "That is not a valid path." };
    }
  } else {
    return { problem: "Paths must start with /, for example /old-page." };
  }

  if (role === "from" && url.search) {
    return { problem: "Query strings (?…) cannot be matched. Remove everything from the ? onwards." };
  }
  const path = `${normalizePublicPath(url.pathname)}${role === "to" ? url.search : ""}`;
  if (path.length > PATH_MAX) return { problem: `Paths must be ${PATH_MAX} characters or fewer.` };
  return { path };
}

export function tokenFor(csvText: string) {
  return createHash("sha256").update(csvText).digest("hex");
}

type ParsedRow = { row: number; from: string; to: string };

function parseRows(csvText: string) {
  const issues: RedirectImportIssue[] = [];
  const table = parseCsv(csvText);
  if (!table.length) {
    issues.push({ row: 1, column: "from_path", problem: "The CSV is empty." });
    return { rows: [] as ParsedRow[], skipped: 0, issues };
  }
  const header = (table[0] ?? []).map((cell) => cell.trim().toLowerCase());
  const fromIndex = header.indexOf("from_path");
  const toIndex = header.indexOf("to_path");
  const missing = [fromIndex < 0 ? "from_path" : null, toIndex < 0 ? "to_path" : null].filter(Boolean);
  if (missing.length) {
    issues.push({ row: 1, column: String(missing[0]), problem: `Missing columns: ${missing.join(", ")}.` });
    return { rows: [] as ParsedRow[], skipped: 0, issues };
  }
  const dataRows = table.slice(1);
  if (dataRows.length > REDIRECT_IMPORT_MAX_ROWS) {
    issues.push({
      row: 1,
      column: "from_path",
      problem: `Upload at most ${REDIRECT_IMPORT_MAX_ROWS} redirects at a time. This file has ${dataRows.length}.`,
    });
    return { rows: [] as ParsedRow[], skipped: 0, issues };
  }
  const rows: ParsedRow[] = [];
  let skipped = 0;
  dataRows.forEach((cells, index) => {
    const from = (cells[fromIndex] ?? "").trim();
    const to = (cells[toIndex] ?? "").trim();
    if (!from && !to) {
      skipped += 1;
      return;
    }
    rows.push({ row: index + 2, from, to });
  });
  return { rows, skipped, issues };
}

/** Pure validation and planning, so it can be tested without a database. */
export function planRedirectImport(csvText: string, context: RedirectImportContext) {
  const { rows, skipped, issues } = parseRows(csvText);
  const planned: PlannedRedirect[] = [];
  const seen = new Map<string, number>();
  let unchanged = 0;

  for (const { row, from, to } of rows) {
    const fromResult = normalizeRedirectPath(from, "from");
    if (fromResult.problem !== undefined) {
      issues.push({ row, column: "from_path", problem: fromResult.problem });
      continue;
    }
    const toResult = normalizeRedirectPath(to, "to");
    if (toResult.problem !== undefined) {
      issues.push({ row, column: "to_path", problem: toResult.problem });
      continue;
    }
    const fromPath = fromResult.path;
    const toPath = toResult.path;

    if (fromPath === "/") {
      issues.push({ row, column: "from_path", problem: "The home page cannot be redirected." });
      continue;
    }
    if (isReserved(fromPath)) {
      issues.push({ row, column: "from_path", problem: "Paths starting with /api, /admin or /_next cannot be redirected." });
      continue;
    }
    if (toPath === fromPath) {
      issues.push({ row, column: "to_path", problem: "A redirect cannot point at itself." });
      continue;
    }
    const firstRow = seen.get(fromPath);
    if (firstRow != null) {
      issues.push({ row, column: "from_path", problem: `Duplicate of row ${firstRow}. Each old path can only appear once.` });
      continue;
    }
    seen.set(fromPath, row);

    if (context.managed.has(fromPath)) {
      issues.push({
        row,
        column: "from_path",
        problem: "This path is set from a product or article's Legacy website URL. Change it in that editor instead.",
      });
      continue;
    }
    if (context.liveProductPaths.has(fromPath)) {
      issues.push({ row, column: "from_path", problem: "This is a live product page, so the redirect would never be used." });
      continue;
    }

    const current = context.existing.get(fromPath);
    if (current === toPath) {
      unchanged += 1;
      continue;
    }
    planned.push({ row, fromPath, toPath, kind: current === undefined ? "create" : "update" });
  }

  // A destination that is itself redirected must not lead back to its start.
  const finalTarget = new Map(context.existing);
  for (const item of planned) finalTarget.set(item.fromPath, item.toPath);
  const stripQuery = (path: string) => normalizePublicPath(path.split("?")[0] ?? path);
  const looped = new Set<number>();
  for (const item of planned) {
    let hops = 0;
    let next: string | undefined = stripQuery(item.toPath);
    while (next !== undefined && hops < LOOP_HOP_LIMIT) {
      if (next === item.fromPath) {
        looped.add(item.row);
        issues.push({ row: item.row, column: "to_path", problem: "This creates a redirect loop back to the old path." });
        break;
      }
      const target: string | undefined = finalTarget.get(next);
      next = target === undefined ? undefined : stripQuery(target);
      hops += 1;
    }
  }

  issues.sort((a, b) => a.row - b.row);
  return {
    rows: rows.length,
    skipped,
    unchanged,
    issues,
    planned: planned.filter((item) => !looped.has(item.row)),
  };
}

export function redirectImportReport(csvText: string, plan: ReturnType<typeof planRedirectImport>): RedirectImportReport {
  const changes = plan.planned.map((item) =>
    `${item.kind === "create" ? "Add" : "Change"} ${item.fromPath} → ${item.toPath}`);
  const preview = changes.slice(0, PLANNED_CHANGE_PREVIEW);
  if (changes.length > preview.length) preview.push(`…and ${changes.length - preview.length} more`);
  return {
    token: tokenFor(csvText),
    rows: plan.rows,
    created: plan.planned.filter((item) => item.kind === "create").length,
    updated: plan.planned.filter((item) => item.kind === "update").length,
    unchanged: plan.unchanged,
    skipped: plan.skipped,
    issues: plan.issues,
    plannedChanges: preview,
  };
}
