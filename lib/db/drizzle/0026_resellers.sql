CREATE TABLE IF NOT EXISTS "ih_reseller_brands" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "name" text NOT NULL,
  "kind" text NOT NULL,
  "website" text NOT NULL DEFAULT '',
  "logo_src" text NOT NULL DEFAULT '',
  "logo_asset_id" text,
  "sort_order" integer NOT NULL DEFAULT 0,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "ih_reseller_brands_name_unique"
  ON "ih_reseller_brands" (lower("name"));

CREATE TABLE IF NOT EXISTS "ih_reseller_outlets" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "brand_id" integer NOT NULL REFERENCES "ih_reseller_brands"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "address" text NOT NULL DEFAULT '',
  "suburb" text NOT NULL DEFAULT '',
  "postcode" text NOT NULL DEFAULT '',
  "region" text NOT NULL DEFAULT '',
  "phone" text NOT NULL DEFAULT '',
  "email" text NOT NULL DEFAULT '',
  "maps_url" text NOT NULL DEFAULT '',
  "sort_order" integer NOT NULL DEFAULT 0,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "ih_reseller_outlets_brand_name_unique"
  ON "ih_reseller_outlets" ("brand_id", lower("name"));

INSERT INTO "ih_reseller_brands" ("name", "kind", "website", "logo_src", "sort_order", "active")
VALUES
  ('Elders', 'elders', '', '', 0, true),
  ('Nutrien', 'nutrien', '', '', 1, true);
