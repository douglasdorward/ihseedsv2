export type ImageUsageSummary = {
  total: number;
  draft: number;
  published: number;
  product?: number;
  category?: number;
  static?: number;
  article?: number;
  reseller?: number;
  protected?: number;
};

function countLabel(count: number, one: string, many: string) {
  return count === 1 ? one : `${count} ${many}`;
}

export function imageUsageSentence(
  usage: ImageUsageSummary,
  productNames: string[] = [],
): string {
  if (!usage.total) return "Not used on any page";

  const parts: string[] = [];
  if (productNames.length) parts.push(productNames.join(", "));
  if (usage.article) parts.push(countLabel(usage.article, "an article", "articles"));
  if (usage.static) parts.push(countLabel(usage.static, "homepage", "site pages"));
  if (usage.reseller) parts.push(countLabel(usage.reseller, "a reseller", "resellers"));
  if (usage.category) parts.push(countLabel(usage.category, "a category page", "category pages"));

  const sentence = parts.length
    ? `Appears on ${parts.join(", ")}`
    : `Appears on ${countLabel(usage.total, "1 page", "pages")}`;
  if (usage.draft > 0 && usage.published > 0) return `${sentence} (draft + published)`;
  return sentence;
}

export function imageUsageLine(
  asset: { width?: number | null; height?: number | null; usageSummary: ImageUsageSummary },
  productNames: string[] = [],
): string {
  const size = asset.width && asset.height ? `${asset.width}×${asset.height}` : "WebP";
  return `${size} · ${imageUsageSentence(asset.usageSummary, productNames)}`;
}
