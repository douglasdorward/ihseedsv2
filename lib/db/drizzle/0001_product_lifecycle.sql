ALTER TABLE "ih_products"
  ADD COLUMN IF NOT EXISTS "published_at" timestamp with time zone;

UPDATE "ih_products"
SET "published_at" = COALESCE("published_at", "created_at")
WHERE "publish_status" = 'Published';

CREATE TABLE IF NOT EXISTS "ih_product_drafts" (
  "id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "product_id" integer NOT NULL UNIQUE REFERENCES "ih_products"("id") ON DELETE CASCADE,
  "snapshot" jsonb NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);