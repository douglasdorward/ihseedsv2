ALTER TABLE "ih_catalogue_categories"
  ADD COLUMN IF NOT EXISTS "page_heading" text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "seo_title" text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "seo_description" text NOT NULL DEFAULT '';