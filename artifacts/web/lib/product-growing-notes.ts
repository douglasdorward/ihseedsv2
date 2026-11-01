/** Default expandable sections, in the order customers see them. Titles are fixed. */
export const DEFAULT_GROWING_NOTE_SECTIONS = [
  { key: "grazingManagementNotes", title: "Planting & grazing notes" },
  { key: "diseasePestResistance", title: "Disease & pest resistance" },
  { key: "standLifeNotes", title: "Stand life" },
  { key: "carbonFarmingNotes", title: "Carbon Farming & Pasture Diversity" },
] as const;

export type GrowingNoteDetails = {
  grazingManagementNotes?: string;
  diseasePestResistance?: string;
  standLifeNotes?: string;
  carbonFarmingNotes?: string;
  customSections?: Array<{ title?: string; body?: string }>;
};

export type GrowingNote = { title: string; body: string };

/**
 * Every expandable product section a customer can see: the four defaults,
 * then administrator-titled sections in their saved order. A section with no
 * text, or a custom section with no title, is left out. The product page,
 * tech sheet, site search and llms.txt all read from this list.
 */
export function productGrowingNotes(details: GrowingNoteDetails | undefined | null): GrowingNote[] {
  if (!details) return [];
  const defaults = DEFAULT_GROWING_NOTE_SECTIONS.map(({ key, title }) => ({ title, body: details[key] ?? "" }));
  const custom = (details.customSections ?? []).map((section) => ({
    title: (section?.title ?? "").trim(),
    body: section?.body ?? "",
  }));
  return [...defaults, ...custom]
    .filter((note) => note.title && note.body.trim())
    .map((note) => ({ title: note.title, body: note.body.trim() }));
}
