ALTER TABLE "ih_catalogue_categories"
  ADD COLUMN IF NOT EXISTS "social_title" text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "social_description" text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "social_image" text NOT NULL DEFAULT '';
