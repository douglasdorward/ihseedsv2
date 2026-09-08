-- Persist the old irwinhunter.com.au product URLs carried by the Website SEO
-- workbook sheet. Redirect paths remain separate because more than one old URL
-- can resolve to the same current product.
WITH legacy_urls(product_slug, legacy_url) AS (
  VALUES
    ('souwest-pasture-mix-2', 'https://irwinhunter.com.au/product/souwest-pasture-mix/'),
    ('avalon-persistent-perennial-ryegrass', 'https://irwinhunter.com.au/product/avalon-persistent-perennial-ryegrass/'),
    ('hard-seeded-persian-clover', 'https://irwinhunter.com.au/product/hard-seeded-persian-clover/'),
    ('icon-lucerne', 'https://irwinhunter.com.au/product/icon-lucerne/'),
    ('anywhere-tall-fescue', 'https://irwinhunter.com.au/product/anywhere-tall-fescue/'),
    ('nemnuke-biofumigant', 'https://irwinhunter.com.au/product/nemnuke-biofumigant/'),
    ('parafield-peas', 'https://irwinhunter.com.au/product/parafield-peas/')
)
UPDATE ih_products AS product
SET website_url_legacy = legacy_urls.legacy_url,
    updated_at = now()
FROM legacy_urls
WHERE product.slug = legacy_urls.product_slug;

INSERT INTO ih_redirects (from_path, to_path)
VALUES
  ('/product/souwest-pasture-mix', '/product/souwest-pasture-mix-2'),
  ('/product/avalon-persistent-perennial-ryegrass', '/products/ryegrass#catalogue'),
  ('/product/hard-seeded-persian-clover', '/products/clovers#catalogue'),
  ('/product/soft-seeded-persian-clover', '/products/clovers#catalogue'),
  ('/product/icon-lucerne', '/products/lucerne#catalogue'),
  ('/product/anywhere-tall-fescue', '/products/fescues-other-grasses#catalogue'),
  ('/product/nemnuke-biofumigant', '/products/forage-grain-crops#catalogue'),
  ('/product/parafield-peas', '/products/forage-grain-crops#catalogue')
ON CONFLICT (from_path) DO UPDATE
SET to_path = EXCLUDED.to_path,
    updated_at = now();