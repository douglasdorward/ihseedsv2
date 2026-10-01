-- Media references are recorded for articles and resellers as well as
-- products, categories, and static pages. Existing databases carry an older
-- owner_type check that rejects the newer owners, which made attaching an
-- article hero image fail. Replace it with one that matches the application.
ALTER TABLE ih_media_references DROP CONSTRAINT IF EXISTS ih_media_references_owner_type_check;
ALTER TABLE ih_media_references ADD CONSTRAINT ih_media_references_owner_type_check
  CHECK (owner_type IN ('product', 'category', 'static', 'article', 'reseller'));
