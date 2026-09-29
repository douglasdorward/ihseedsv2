ALTER TABLE "ih_articles" ADD COLUMN IF NOT EXISTS "pdfs" jsonb DEFAULT '[]'::jsonb NOT NULL;
