-- Publishing compares the development and production databases. It did not
-- pick up 0042, which changed the contents of
-- ih_media_references_owner_type_check but kept its name, so production kept
-- rejecting article and reseller media references. Under a new name, the
-- publish diff sees a dropped constraint and an added one, and applies both.
ALTER TABLE ih_media_references DROP CONSTRAINT IF EXISTS ih_media_references_owner_type_check;
ALTER TABLE ih_media_references DROP CONSTRAINT IF EXISTS ih_media_references_owner_type_allowed;
ALTER TABLE ih_media_references ADD CONSTRAINT ih_media_references_owner_type_allowed
  CHECK (owner_type IN ('product', 'category', 'static', 'article', 'reseller'));
