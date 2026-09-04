-- Product Admin v2 is additive: legacy JSON fields remain readable while new
-- sale-line and redirect records become the source of selling/listing data.
ALTER TABLE ih_products ADD COLUMN IF NOT EXISTS guide_year text NOT NULL DEFAULT '';
ALTER TABLE ih_products ADD COLUMN IF NOT EXISTS description_source text NOT NULL DEFAULT '';
ALTER TABLE ih_products ADD COLUMN IF NOT EXISTS website_url_legacy text NOT NULL DEFAULT '';
ALTER TABLE ih_products ADD COLUMN IF NOT EXISTS availability_override text;
ALTER TABLE ih_products ADD COLUMN IF NOT EXISTS listing_override text;
CREATE TABLE IF NOT EXISTS ih_sale_lines (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id integer NOT NULL REFERENCES ih_products(id) ON DELETE CASCADE,
  stock_code text NOT NULL UNIQUE,
  seed_form text NOT NULL DEFAULT '', seed_grade text NOT NULL DEFAULT '',
  pack_kg numeric(8,2), pack_unit text NOT NULL DEFAULT 'kg',
  availability text NOT NULL DEFAULT 'Unavailable',
  price_display text NOT NULL DEFAULT 'Contact for pricing',
  is_default boolean NOT NULL DEFAULT false, sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ih_sale_lines_one_default_per_product
  ON ih_sale_lines(product_id) WHERE is_default;
CREATE TABLE IF NOT EXISTS ih_redirects (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, from_path text NOT NULL UNIQUE,
  to_path text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ih_product_options (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, list_name text NOT NULL,
  value text NOT NULL, sort_order integer NOT NULL DEFAULT 0, UNIQUE(list_name, value)
);
-- Corrective, one-time compatibility backfill; never performed at request time.
UPDATE ih_products SET details = jsonb_set(details, '{standLifeNotes}',
  COALESCE(details->'standLifeNotes', details->'persistenceLongevity', '""'::jsonb), true)
WHERE NOT details ? 'standLifeNotes';