-- Records which generation of stored variants (1600px full + 800px card WebP)
-- each library asset has, so "Refine existing images" only processes assets
-- that still need it and the admin can hide the button when none do.
-- Existing assets start at 0; refining checks each one and stamps it without
-- re-encoding when its stored files are already current.
ALTER TABLE ih_media_assets ADD COLUMN IF NOT EXISTS variants_version integer NOT NULL DEFAULT 0;
