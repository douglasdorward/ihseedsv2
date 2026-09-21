UPDATE ih_catalogue_categories
SET active = false
WHERE parent_id IS NULL AND slug = 'other';
