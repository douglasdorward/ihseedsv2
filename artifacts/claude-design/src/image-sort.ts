export type MediaSort = "newest" | "filename";

export const MEDIA_SORT_OPTIONS: Array<{ value: MediaSort; label: string }> = [
  { value: "newest", label: "Newest first" },
  { value: "filename", label: "File name A to Z" },
];

type SortableAsset = { originalFilename: string; createdAt: string };

/** Newest keeps the API order. File name is case-insensitive and numeric-aware, newest first on ties. */
export function sortMediaAssets<T extends SortableAsset>(items: T[], sort: MediaSort): T[] {
  if (sort === "newest") return items;
  return [...items].sort((first, second) => (
    first.originalFilename.localeCompare(second.originalFilename, undefined, { numeric: true, sensitivity: "base" })
    || second.createdAt.localeCompare(first.createdAt)
  ));
}
