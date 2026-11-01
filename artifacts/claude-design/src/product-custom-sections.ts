import type { ProductCustomSection } from "@workspace/api-client-react";

/** Matches the server limits in the product details schema. */
export const PRODUCT_CUSTOM_SECTION_LIMIT = 10;
export const PRODUCT_CUSTOM_SECTION_TITLE_MAX = 80;
export const PRODUCT_NOTE_MAX = 3000;
export const CARBON_FARMING_TITLE = "Carbon Farming & Pasture Diversity";

export function normalizeCustomSections(value: unknown): ProductCustomSection[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, PRODUCT_CUSTOM_SECTION_LIMIT).map((item) => ({
    title: typeof item?.title === "string" ? item.title : "",
    body: typeof item?.body === "string" ? item.body : "",
  }));
}

export function addCustomSection(sections: ProductCustomSection[]) {
  if (sections.length >= PRODUCT_CUSTOM_SECTION_LIMIT) return sections;
  return [...sections, { title: "", body: "" }];
}

export function updateCustomSection(sections: ProductCustomSection[], index: number, patch: Partial<ProductCustomSection>) {
  return sections.map((section, itemIndex) => itemIndex === index ? { ...section, ...patch } : section);
}

export function removeCustomSection(sections: ProductCustomSection[], index: number) {
  return sections.filter((_, itemIndex) => itemIndex !== index);
}

export function moveCustomSection(sections: ProductCustomSection[], index: number, offset: -1 | 1) {
  const target = index + offset;
  if (target < 0 || target >= sections.length) return sections;
  const next = [...sections];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** Explains why a half-filled section is hidden from customers. */
export function customSectionHint(section: ProductCustomSection) {
  const hasTitle = Boolean(section.title.trim());
  const hasBody = Boolean(section.body.trim());
  if (hasTitle && !hasBody) return "Add text, or this section stays hidden on the website.";
  if (!hasTitle && hasBody) return "Add a title, or this section stays hidden on the website.";
  return "";
}
