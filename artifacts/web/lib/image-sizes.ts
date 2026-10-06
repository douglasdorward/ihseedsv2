/**
 * Size hints for photos, matched to the widths they actually show at in the
 * CSS grids (phone, tablet, laptop, wide desktop). Plain vw values are used
 * instead of calc() so next/image keeps the small widths in each srcset.
 * Re-check these when a grid or breakpoint changes.
 */
export const IMAGE_SIZES = {
  /** Homepage best sellers: 1 col ≤520, 2 cols ≤900, 4 cols in a 1180px container. */
  homeProductCard: "(max-width: 520px) 92vw, (max-width: 900px) 46vw, (max-width: 1180px) 22vw, 252px",
  /** /products listing: 1 col ≤900, then 3 cols beside the 260px filter column. */
  listingProductCard: "(max-width: 900px) 100vw, (max-width: 1180px) 20vw, 244px",
  /** Category pages and article cards: 1 col ≤900, then 3 cols in a 1180px container. */
  threeColumnCard: "(max-width: 900px) 100vw, (max-width: 1180px) 29vw, 346px",
  /** Homepage About panel: full width ≤900, then half of a 1360px panel. */
  featurePanel: "(max-width: 900px) 100vw, (max-width: 1440px) 47vw, 680px",
  /** Seed guide banner: full width up to a 1360px panel. */
  guideBanner: "(max-width: 900px) 100vw, (max-width: 1440px) 94vw, 1360px",
  /** "Also popular" cards on product pages. */
  alsoPopularCard: "(max-width: 800px) 100vw, (max-width: 1180px) 30vw, 380px",
  /** Related product cards in an article's side column. */
  articleRelatedCard: "(max-width: 800px) 100vw, 210px",
  /** Photo list in the product page side column. */
  productSidePhoto: "(max-width: 800px) 100vw, 320px",
  /** Photo in an article's body column. */
  articleBodyPhoto: "(max-width: 800px) 100vw, 620px",
} as const;
