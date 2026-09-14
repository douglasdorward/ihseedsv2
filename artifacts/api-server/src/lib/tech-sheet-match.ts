export type MatchableProduct = {
  id: number;
  name: string;
  slug: string;
};

function tokens(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 2 && !["the", "and", "for", "from", "with", "product", "information", "seeds", "ih"].includes(part));
}

export function matchProductFromFilename(filename: string, products: MatchableProduct[]) {
  const stem = filename.replace(/\.pdf$/i, "");
  const haystack = tokens(stem).join(" ");
  const exactSlug = products.filter((product) => stem.toLowerCase().includes(product.slug) || haystack.includes(product.slug.replace(/-/g, " ")));
  if (exactSlug.length === 1) return exactSlug[0];
  const scored = products.map((product) => {
    const nameTokens = tokens(product.name);
    const hits = nameTokens.filter((token) => haystack.includes(token)).length;
    return { product, score: nameTokens.length ? hits / nameTokens.length : 0 };
  }).filter((row) => row.score >= 0.6).sort((a, b) => b.score - a.score);
  if (scored.length === 1 || (scored[0] && scored[0].score >= 0.9 && (!scored[1] || scored[0].score - scored[1].score >= 0.2))) {
    return scored[0].product;
  }
  return null;
}
