/** Final slug form: lowercase kebab-case matching ^[a-z0-9]+(?:-[a-z0-9]+)*$. */
export function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

/**
 * Live-typing slug sanitiser. Same rules as slugify (no spaces, no capitals, no
 * symbols) but keeps a trailing hyphen so "a-b" can be typed one key at a time.
 * Run slugify on blur to trim it.
 */
export function sanitizeSlugInput(text: string) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+/, "");
}
