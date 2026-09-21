ALTER TABLE "ih_articles"
  ADD COLUMN IF NOT EXISTS "scheduled_publish_at" timestamp with time zone;

CREATE INDEX IF NOT EXISTS "ih_articles_scheduled_due"
  ON "ih_articles" ("scheduled_publish_at")
  WHERE "publish_status" = 'Scheduled';
