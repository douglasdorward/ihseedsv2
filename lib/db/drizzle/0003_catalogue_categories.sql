CREATE TABLE IF NOT EXISTS "ih_catalogue_categories" (
  "id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "parent_id" integer REFERENCES "ih_catalogue_categories"("id") ON DELETE RESTRICT,
  "slug" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "group_label" text NOT NULL,
  "lead" text NOT NULL DEFAULT '',
  "rainfall" text NOT NULL DEFAULT '',
  "image" text NOT NULL DEFAULT '',
  "sort_order" integer NOT NULL DEFAULT 0,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE "ih_products"
  ADD COLUMN IF NOT EXISTS "subcategory_id" integer REFERENCES "ih_catalogue_categories"("id") ON DELETE RESTRICT;

INSERT INTO "ih_catalogue_categories"
  ("slug", "name", "group_label", "lead", "rainfall", "image", "sort_order", "active")
VALUES
  ('mixes', 'Specialty Mixes', 'Mixes', 'Blended to order for the paddock they are going into. Designed for specific rainfall zones and grazing plans.', '400–800+ mm', 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=900&q=80', 0, true),
  ('ryegrass', 'Ryegrass', 'Grasses', 'Annual, Italian and perennial types for high rainfall and irrigated country.', '500–900+ mm', 'https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=900&q=80', 1, true),
  ('clovers', 'Clovers', 'Legumes', 'Sub, balansa, arrowleaf and Persian clovers across the rainfall range.', '300–700+ mm', 'https://images.unsplash.com/photo-1530507629858-e4977d30e9e0?auto=format&fit=crop&w=900&q=80', 2, true),
  ('fescues-other-grasses', 'Fescues & Other Grasses', 'Grasses', 'Temperate pasture grasses for grazing, hay, persistence and specialist uses.', 'Varies by product', 'https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=900&q=80', 3, true),
  ('serradella', 'Serradellas & Medics', 'Legumes', 'Hard-seeded regenerating legumes for lighter soils and the wheatbelt.', '300–500+ mm', 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=900&q=80', 4, true),
  ('lucerne', 'Lucerne', 'Legumes', 'Persistent hay and grazing stands selected across winter-activity classes.', '350–650+ mm', 'https://images.unsplash.com/photo-1499529112087-3cb3b73cec95?auto=format&fit=crop&w=900&q=80', 5, true),
  ('herbs', 'Pasture Herbs', 'Other', 'Forage herbs selected for productive and diverse pasture systems.', 'Varies by product', 'https://images.unsplash.com/photo-1530507629858-e4977d30e9e0?auto=format&fit=crop&w=900&q=80', 6, true),
  ('sub-tropical-grasses', 'Sub-Tropical Grasses', 'Grasses', 'Warm-season grasses for resilient grazing systems in suitable regions.', 'Varies by product', 'https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=900&q=80', 7, true),
  ('biologicals', 'Biologicals', 'Other', 'Seed-applied and pasture biological products supporting establishment and performance.', 'See product details', 'https://images.unsplash.com/photo-1499529112087-3cb3b73cec95?auto=format&fit=crop&w=900&q=80', 8, true),
  ('forage-grain-crops', 'Forage & Grain Crops', 'Other', 'Seasonal forage and grain options for grazing, conserved feed and rotations.', 'Varies by product', 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=900&q=80', 9, true),
  ('other', 'Other Products', 'Other', 'Additional pasture and seed products available from the current IH Seeds range.', 'See product details', 'https://images.unsplash.com/photo-1530507629858-e4977d30e9e0?auto=format&fit=crop&w=900&q=80', 10, true)
ON CONFLICT ("slug") DO NOTHING;

UPDATE "ih_products" AS product
SET "subcategory_id" = category.id
FROM "ih_catalogue_categories" AS category
WHERE product."subcategory_id" IS NULL
  AND lower(btrim(product."category")) IN (
    lower(category."name"),
    CASE category."slug" WHEN 'mixes' THEN 'mixes' ELSE '' END,
    CASE category."slug" WHEN 'ryegrass' THEN 'ryegrasses' ELSE '' END,
    CASE category."slug" WHEN 'serradella' THEN 'serradellas & medic' ELSE '' END,
    CASE category."slug" WHEN 'herbs' THEN 'herbs' ELSE '' END,
    CASE category."slug" WHEN 'other' THEN 'other' ELSE '' END
  );