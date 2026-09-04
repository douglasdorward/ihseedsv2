WITH category_corrections(name, slug, legacy_category, category) AS (
  VALUES
    ('Silahay™ Mix', 'silahay-mix', 'Other', 'Specialty Mixes'),
    ('Self Regeneration Pasture Mix', 'self-regeneration-pasture-mix', 'Other', 'Specialty Mixes'),
    ('Ceres PG One50 Ryegrass', 'ceres-pg-one50-ryegrass', 'Other', 'Ryegrasses'),
    ('Ceres PG One50 Ryegrass', 'ceres-pg-one50-ryegrass', 'Specialty Mixes', 'Ryegrasses'),
    ('Margurita French Serradella', 'margurita-french-serradella', 'Other', 'Serradellas & Medics'),
    ('Margurita French Serradella', 'margurita-french-serradella', 'Specialty Mixes', 'Serradellas & Medics'),
    ('SARDI Seven Lucerne', 'sardi-seven-lucerne', 'Other', 'Lucerne'),
    ('SARDI Seven Lucerne', 'sardi-seven-lucerne', 'Specialty Mixes', 'Lucerne'),
    ('Dalkeith Subterranean Clover', 'dalkeith-subterranean-clover', 'Other', 'Clovers'),
    ('Dalkeith Subterranean Clover', 'dalkeith-subterranean-clover', 'Specialty Mixes', 'Clovers')
)
UPDATE ih_products AS product
SET category = correction.category
FROM category_corrections AS correction
WHERE product.name = correction.name
  AND product.slug = correction.slug
  AND product.category = correction.legacy_category
  AND product.publish_status = 'Published'
  AND NOT EXISTS (
    SELECT 1
    FROM ih_product_drafts AS draft
    WHERE draft.product_id = product.id
  );