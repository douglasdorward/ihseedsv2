INSERT INTO ih_redirects (from_path, to_path)
SELECT '/product/souwest-pasture-mix', '/products/' || root.slug || '/' || p.slug
FROM ih_products AS p
JOIN ih_catalogue_categories AS root
  ON root.parent_id IS NULL
 AND root.name = p.category
WHERE p.slug = 'souwest-pasture-mix'
ON CONFLICT (from_path) DO UPDATE
SET to_path = EXCLUDED.to_path,
    updated_at = now();
