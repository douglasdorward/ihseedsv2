ALTER TABLE "ih_catalogue_categories"
  ADD COLUMN IF NOT EXISTS "buying_guide" text NOT NULL DEFAULT '';
