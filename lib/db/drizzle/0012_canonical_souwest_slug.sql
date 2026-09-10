-- Give the live SouWest product the canonical slug. A leftover Draft still
-- occupies souwest-pasture-mix, so park that row first. Old -2 URLs redirect
-- to the canonical path.
UPDATE ih_products
SET slug = 'souwest-pasture-mix-legacy', updated_at = now()
WHERE slug = 'souwest-pasture-mix'
  AND publish_status = 'Draft'
  AND EXISTS (
    SELECT 1 FROM ih_products
    WHERE slug = 'souwest-pasture-mix-2' AND publish_status = 'Published'
  );

UPDATE ih_products
SET slug = 'souwest-pasture-mix', updated_at = now()
WHERE slug = 'souwest-pasture-mix-2' AND publish_status = 'Published';

DELETE FROM ih_redirects
WHERE from_path = '/product/souwest-pasture-mix'
  AND to_path = '/product/souwest-pasture-mix-2';

INSERT INTO ih_redirects (from_path, to_path)
VALUES ('/product/souwest-pasture-mix-2', '/product/souwest-pasture-mix')
ON CONFLICT (from_path) DO UPDATE
SET to_path = EXCLUDED.to_path,
    updated_at = now();
