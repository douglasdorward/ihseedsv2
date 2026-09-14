CREATE TABLE IF NOT EXISTS "ih_ai_ingest_items" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "filename" text NOT NULL,
  "storage_key" text NOT NULL,
  "mime_type" text NOT NULL DEFAULT 'application/pdf',
  "status" text NOT NULL DEFAULT 'uploaded',
  "product_id" integer,
  "extracted_text_hash" text NOT NULL DEFAULT '',
  "proposed_patch" jsonb,
  "warnings" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "error_message" text NOT NULL DEFAULT '',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE "ih_ai_ingest_items"
  ADD CONSTRAINT "ih_ai_ingest_items_product_id_ih_products_id_fk"
  FOREIGN KEY ("product_id") REFERENCES "ih_products"("id") ON DELETE SET NULL;
