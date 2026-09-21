ALTER TABLE "ih_site_settings"
  ADD COLUMN IF NOT EXISTS "about" jsonb NOT NULL DEFAULT '{}'::jsonb;
