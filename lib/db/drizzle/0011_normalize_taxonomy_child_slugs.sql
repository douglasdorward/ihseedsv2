-- Child slugs are path segments, not a repetition of their parent segment.
-- Scope slug uniqueness to a parent so the same meaningful child segment can
-- safely exist below different roots.
ALTER TABLE "ih_catalogue_categories"
  DROP CONSTRAINT IF EXISTS "ih_catalogue_categories_slug_unique",
  DROP CONSTRAINT IF EXISTS "ih_catalogue_categories_slug_key";
DROP INDEX IF EXISTS "ih_catalogue_categories_slug_unique";
CREATE UNIQUE INDEX IF NOT EXISTS "ih_catalogue_categories_parent_slug_unique"
  ON "ih_catalogue_categories" (COALESCE("parent_id", 0), "slug");

CREATE TEMP TABLE taxonomy_child_slug_changes ON COMMIT DROP AS
SELECT child.id,
       child.parent_id,
       child.slug AS old_slug,
       substring(child.slug FROM char_length(parent.slug) + 2) AS new_slug,
       NULL::text AS final_slug
FROM ih_catalogue_categories AS child
JOIN ih_catalogue_categories AS parent ON parent.id = child.parent_id
WHERE child.slug LIKE parent.slug || '-%'
  AND substring(child.slug FROM char_length(parent.slug) + 2) <> '';

-- Move through collision-proof temporary values first. This also makes the
-- migration safe when two rows exchange a previously occupied slug.
UPDATE ih_catalogue_categories AS category
SET slug = '__taxonomy-normalize-' || category.id
FROM taxonomy_child_slug_changes AS change
WHERE category.id = change.id;

-- Resolve collisions against unchanged siblings and earlier normalized rows
-- in a stable parent/base/id order. Existing canonical child slugs retain
-- their segment; redundant prefixed rows receive foo-2, foo-3, and so on.
DO $$
DECLARE
  change record;
  candidate text;
  suffix integer;
BEGIN
  FOR change IN
    SELECT * FROM taxonomy_child_slug_changes
    ORDER BY parent_id, new_slug, id
  LOOP
    candidate := change.new_slug;
    suffix := 2;
    WHILE EXISTS (
      SELECT 1
      FROM ih_catalogue_categories AS sibling
      WHERE sibling.parent_id IS NOT DISTINCT FROM change.parent_id
        AND sibling.slug = candidate
    ) LOOP
      candidate := change.new_slug || '-' || suffix;
      suffix := suffix + 1;
    END LOOP;
    UPDATE ih_catalogue_categories
    SET slug = candidate, updated_at = now()
    WHERE id = change.id;
    UPDATE taxonomy_child_slug_changes
    SET final_slug = candidate
    WHERE id = change.id;
  END LOOP;
END
$$;

-- Preserve every old nested child URL, including inactive taxonomy records.
-- An inactive child has no public child page, so a live parent is its safe
-- landing page. If the parent is inactive too, use the catalogue index rather
-- than redirecting to an unavailable category page. A single active child
-- deliberately shares its parent's URL.
INSERT INTO ih_redirects (from_path, to_path, updated_at)
SELECT '/products/' || parent.slug || '/' || change.old_slug,
       CASE
         WHEN NOT parent.active THEN '/products'
         WHEN NOT child.active OR active_children.count = 1 THEN '/products/' || parent.slug
         ELSE '/products/' || parent.slug || '/' || child.slug
       END,
       now()
FROM taxonomy_child_slug_changes AS change
JOIN ih_catalogue_categories AS child ON child.id = change.id
JOIN ih_catalogue_categories AS parent ON parent.id = child.parent_id
JOIN LATERAL (
  SELECT count(*)::integer
  FROM ih_catalogue_categories AS sibling
  WHERE sibling.parent_id = parent.id AND sibling.active
) AS active_children ON true
ON CONFLICT (from_path) DO UPDATE
SET to_path = EXCLUDED.to_path, updated_at = EXCLUDED.updated_at;