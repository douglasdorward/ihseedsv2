ALTER TABLE "ih_catalogue_categories"
  ADD COLUMN IF NOT EXISTS "faqs" jsonb NOT NULL DEFAULT '[]'::jsonb;
