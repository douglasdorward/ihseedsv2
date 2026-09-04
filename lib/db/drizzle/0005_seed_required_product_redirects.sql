INSERT INTO ih_redirects (from_path, to_path)
VALUES
  ('/product/souwest-pasture-mix', '/product/souwest-pasture-mix-2'),
  ('/product/icon-lucerne', '/products/lucerne#catalogue')
ON CONFLICT (from_path) DO UPDATE
SET to_path = EXCLUDED.to_path,
    updated_at = now();