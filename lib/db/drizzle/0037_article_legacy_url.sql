ALTER TABLE "ih_articles"
  ADD COLUMN IF NOT EXISTS "website_url_legacy" text NOT NULL DEFAULT '';
