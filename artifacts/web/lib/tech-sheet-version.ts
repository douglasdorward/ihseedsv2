import { createHash } from "node:crypto";

/** Raise when the sheet layout changes in a way that must replace every stored PDF, even in development. */
export const TECH_SHEET_TEMPLATE_VERSION = 1;

export type TechSheetSource = {
  /** The public product record the sheet page draws from. */
  product: unknown;
  /** The product page link printed in the footer. */
  productUrl: string;
  /** The range year printed in the header. */
  year: number;
  /** Changes on every publish, so a new sheet design replaces old PDFs. */
  build: string;
};

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [key, stable((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}

/** A fingerprint of everything printed on the sheet. Any change gives a new stored PDF. */
export function techSheetVersion(source: TechSheetSource) {
  return createHash("sha256")
    .update(JSON.stringify(stable({ template: TECH_SHEET_TEMPLATE_VERSION, ...source })))
    .digest("hex");
}
