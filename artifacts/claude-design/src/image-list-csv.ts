import type { AdminProduct } from "@workspace/api-client-react";

function csvCell(value: string) {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function listingState(product: { listingState?: unknown; listingOverride?: unknown }) {
  if (product.listingState === "Legacy" || product.listingOverride === "Force legacy" || product.listingOverride === "Legacy") return "Legacy";
  if (product.listingState === "New") return "New";
  return "Active";
}

export function productListingState(product: { listingState?: unknown; listingOverride?: unknown }) {
  return listingState(product);
}

function productPhotoSlots(product: AdminProduct) {
  return (product.details?.photos ?? []).filter((photo) => Boolean(photo?.src?.trim() || photo?.assetId)).slice(0, 3);
}

export function downloadImageListCsv(products: AdminProduct[]) {
  const header = ["product_name", "slug", "listing_state", "lifecycle_status", "has_image", "photo_count", "suggested_filename"];
  const lines = [
    header.join(","),
    ...products.map((product) => {
      const slug = product.slug ?? "";
      const photoCount = productPhotoSlots(product).length;
      return [
        csvCell(product.name ?? ""),
        csvCell(slug),
        csvCell(listingState(product)),
        csvCell(product.lifecycleStatus ?? ""),
        photoCount > 0 ? "Y" : "N",
        String(photoCount),
        csvCell(slug ? `${slug}.jpg` : ""),
      ].join(",");
    }),
  ];
  const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "ih-seeds-image-list.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
