-- Rebuild the public redirect table from each product's stored current-site
-- Legacy website URL. Destinations are the live nested product paths. This
-- matches workbook import and removes leftover taxonomy rows that could steal
-- a product canonical URL.

DELETE FROM ih_redirects;

INSERT INTO ih_redirects (from_path, to_path)
SELECT DISTINCT ON (from_path) from_path, to_path
FROM (
  SELECT
    regexp_replace(
      regexp_replace(
        substring(p.website_url_legacy from 'https?://[^/?#]+(/[^?#]*)'),
        '/+$',
        ''
      ),
      '^$',
      '/'
    ) AS from_path,
    '/products/' || root.slug || '/' || p.slug AS to_path
  FROM ih_products AS p
  JOIN ih_catalogue_categories AS root
    ON root.parent_id IS NULL
   AND root.name = p.category
  WHERE p.website_url_legacy ~* '^https?://(www\.)?irwinhunter\.com\.au/'
    AND p.website_url_legacy !~ '[?#]'
    AND substring(p.website_url_legacy from 'https?://[^/?#]+(/[^?#]*)') IS NOT NULL
) AS mapped
WHERE from_path <> to_path
  AND from_path LIKE '/%'
ORDER BY from_path, to_path;
