-- Catalogue URL contract: /products is the index, nested child taxonomy
-- paths are no longer public, and live products live at
-- /products/{category}/{slug}. Preserve former public addresses.

INSERT INTO ih_redirects (from_path, to_path, updated_at)
VALUES ('/products/categories', '/products', now())
ON CONFLICT (from_path) DO UPDATE
SET to_path = EXCLUDED.to_path, updated_at = now();

UPDATE ih_redirects
SET to_path = '/products', updated_at = now()
WHERE to_path = '/products/categories';

UPDATE ih_redirects
SET to_path = regexp_replace(to_path, '#catalogue$', ''), updated_at = now()
WHERE to_path LIKE '%#catalogue';

UPDATE ih_redirects AS redirect
SET to_path = '/products/' || root.slug || '/' || product.slug,
    updated_at = now()
FROM ih_products AS product
JOIN ih_catalogue_categories AS root
  ON root.parent_id IS NULL
 AND root.name = product.category
WHERE redirect.to_path IN (
    '/product/' || product.slug,
    '/product/' || product.slug || '/'
  )
  AND product.publish_status = 'Published'
  AND product.listing_override = 'Active';

INSERT INTO ih_redirects (from_path, to_path, updated_at)
SELECT '/products/' || parent.slug || '/' || child.slug,
       '/products/' || parent.slug,
       now()
FROM ih_catalogue_categories AS child
JOIN ih_catalogue_categories AS parent ON parent.id = child.parent_id
WHERE NOT EXISTS (
  SELECT 1 FROM ih_products AS product
  WHERE product.slug = child.slug
    AND product.publish_status = 'Published'
    AND product.listing_override = 'Active'
)
ON CONFLICT (from_path) DO UPDATE
SET to_path = EXCLUDED.to_path, updated_at = now();

INSERT INTO ih_redirects (from_path, to_path)
VALUES
  ('/lucerne', '/products/lucerne'),
  ('/serradella', '/products/serradella'),
  ('/sub-tropical', '/products/sub-tropical-grasses'),
  ('/other-grasses', '/products/fescues-other-grasses'),
  ('/forage-crops', '/products/forage-grain-crops'),
  ('/perennial-herbs', '/products/herbs'),
  ('/pasture-mixes', '/products/mixes'),
  ('/subterranean-clovers', '/products/clovers'),
  ('/aerial-seeded-clovers', '/products/clovers'),
  ('/white-clovers', '/products/clovers'),
  ('/biennial-ryegrass', '/products/ryegrass'),
  ('/perennial-ryegrasses', '/products/ryegrass'),
  ('/annual-ryegrass', '/products/ryegrass'),
  ('/pasture-seed-guide', '/guide'),
  ('/current-availability-of-our-seeds', '/availability'),
  ('/news', '/resources'),
  ('/articles', '/resources'),
  ('/publications', '/resources'),
  ('/research-site', '/resources'),
  ('/about-us', '/about'),
  ('/products-and-services', '/products'),
  ('/rainfall-map', '/guide'),
  ('/terms-and-conditions', '/contact'),
  ('/privacy', '/contact')
ON CONFLICT (from_path) DO UPDATE
SET to_path = EXCLUDED.to_path, updated_at = now();
