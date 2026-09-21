ALTER TABLE "ih_site_settings"
  ADD COLUMN IF NOT EXISTS "company" jsonb NOT NULL DEFAULT '{}'::jsonb;
