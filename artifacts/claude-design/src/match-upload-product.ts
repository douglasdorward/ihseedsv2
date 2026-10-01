export type MatchableProduct = {
  id: number;
  name: string;
  slug: string;
};

export type MatchableArticle = {
  id: number;
  title: string;
  slug: string;
};

export type FilenameMatch = {
  productId: string;
  unsure: boolean;
  score: number;
};

export type ArticleFilenameMatch = {
  articleId: string;
  unsure: boolean;
  score: number;
};

type RankedMatch = {
  id: string;
  unsure: boolean;
  score: number;
};

const STRONG = 0.5;
const WEAK = 0.35;
const TIE_GAP = 0.08;

export function normalizeUploadStem(filename: string) {
  const base = filename.replace(/^.*[/\\]/, "").replace(/\.[^.]+$/, "");
  return base
    .toLowerCase()
    .normalize("NFKD")
    .replace(/-\d+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function slugifyLabel(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function levenshtein(left: string, right: string) {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 0; i < left.length; i += 1) {
    let lastDiagonal = previous[0];
    previous[0] = i + 1;
    for (let j = 0; j < right.length; j += 1) {
      const nextDiagonal = previous[j + 1];
      const cost = left[i] === right[j] ? 0 : 1;
      previous[j + 1] = Math.min(previous[j] + 1, previous[j + 1] + 1, lastDiagonal + cost);
      lastDiagonal = nextDiagonal;
    }
  }
  return previous[right.length];
}

function similarity(left: string, right: string) {
  if (!left || !right) return 0;
  if (left === right) return 1;
  return 1 - levenshtein(left, right) / Math.max(left.length, right.length);
}

function containedScore(stem: string, candidate: string) {
  if (stem.length < 4 || candidate.length < 4) return 0;
  if (!stem.includes(candidate) && !candidate.includes(stem)) return 0;
  const ratio = Math.min(stem.length, candidate.length) / Math.max(stem.length, candidate.length);
  if (ratio >= 0.5) return Math.max(0.86, ratio);
  return Math.max(0.4, ratio);
}

export function scoreFilenameAgainstLabel(stem: string, candidate: string) {
  if (!stem || !candidate) return 0;
  if (stem === candidate) return 1;
  return Math.max(containedScore(stem, candidate), similarity(stem, candidate));
}

function rankFilename(filename: string, candidates: { id: number; labels: string[] }[]): RankedMatch {
  const stem = normalizeUploadStem(filename);
  if (!stem || !candidates.length) return { id: "", unsure: false, score: 0 };

  const ranked = candidates
    .map((candidate) => ({
      id: candidate.id,
      score: candidate.labels.reduce(
        (best, label) => Math.max(best, scoreFilenameAgainstLabel(stem, slugifyLabel(label))),
        0,
      ),
    }))
    .sort((first, second) => second.score - first.score || first.id - second.id);

  const best = ranked[0];
  const runnerUp = ranked[1];
  const tied = Boolean(runnerUp && best.score - runnerUp.score < TIE_GAP);

  if (best.score < WEAK) return { id: "", unsure: false, score: best.score };
  if (best.score > STRONG && !tied) {
    return { id: String(best.id), unsure: false, score: best.score };
  }
  return { id: String(best.id), unsure: true, score: best.score };
}

export function matchUploadToProduct(filename: string, products: MatchableProduct[]): FilenameMatch {
  const match = rankFilename(filename, products.map((product) => ({
    id: product.id,
    labels: [product.slug ?? "", product.name ?? ""],
  })));
  return { productId: match.id, unsure: match.unsure, score: match.score };
}

export function matchUploadToArticle(filename: string, articles: MatchableArticle[]): ArticleFilenameMatch {
  const match = rankFilename(filename, articles.map((article) => ({
    id: article.id,
    labels: [article.slug ?? "", article.title ?? ""],
  })));
  return { articleId: match.id, unsure: match.unsure, score: match.score };
}
