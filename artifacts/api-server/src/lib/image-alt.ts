export const IMAGE_ALT_MAX = 300;

export function humanizeImageFilename(filename: string): string {
  const base = filename.replace(/^.*[/\\]/, "").replace(/\.[^.]+$/, "");
  const words = base.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!words) return "";
  return titleCase(words).slice(0, IMAGE_ALT_MAX);
}

export function imageAltFromContext(input: {
  ownerName?: string | null;
  filename?: string | null;
  role?: string | null;
}): string {
  const owner = (input.ownerName ?? "").trim();
  if (owner) {
    const role = displayRole(input.role);
    return (role ? `${owner} — ${role}` : owner).slice(0, IMAGE_ALT_MAX);
  }
  return humanizeImageFilename(input.filename ?? "");
}

export function shouldReplaceGeneratedAlt(
  currentAlt: string | null | undefined,
  filename?: string | null,
): boolean {
  const current = (currentAlt ?? "").trim();
  if (!current) return true;
  const generated = humanizeImageFilename(filename ?? "");
  return Boolean(generated) && current === generated;
}

export function resolveImageAlt(input: {
  currentAlt?: string | null;
  ownerName?: string | null;
  filename?: string | null;
  role?: string | null;
}): string {
  if (!shouldReplaceGeneratedAlt(input.currentAlt, input.filename)) {
    return (input.currentAlt ?? "").trim().slice(0, IMAGE_ALT_MAX);
  }
  return imageAltFromContext(input);
}

function titleCase(value: string): string {
  return value.replace(/\S+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function displayRole(role?: string | null): string {
  const value = (role ?? "").trim().toLowerCase();
  if (!value || value === "hero") return "";
  return value;
}
