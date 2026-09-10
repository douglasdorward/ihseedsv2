-- Listing state is now a stored Active/Legacy choice. Persist the value that
-- used to be derived from sale-line availability and force overrides.
UPDATE ih_products AS product
SET listing_override = CASE
  WHEN product.listing_override IN ('Force active', 'Active') THEN 'Active'
  WHEN product.listing_override IN ('Force legacy', 'Legacy') THEN 'Legacy'
  WHEN EXISTS (
    SELECT 1 FROM ih_sale_lines AS line
    WHERE line.product_id = product.id
  ) AND NOT EXISTS (
    SELECT 1 FROM ih_sale_lines AS line
    WHERE line.product_id = product.id
      AND line.availability IS DISTINCT FROM 'Unavailable'
  ) THEN 'Legacy'
  ELSE 'Active'
END;

UPDATE ih_products SET listing_override = 'Active' WHERE listing_override IS NULL;

ALTER TABLE ih_products ALTER COLUMN listing_override SET DEFAULT 'Active';
ALTER TABLE ih_products ALTER COLUMN listing_override SET NOT NULL;

UPDATE ih_products
SET availability_override = NULL, status = 'unavailable'
WHERE listing_override = 'Legacy';

UPDATE ih_sale_lines AS line
SET availability = 'Unavailable'
FROM ih_products AS product
WHERE line.product_id = product.id
  AND product.listing_override = 'Legacy';

UPDATE ih_product_drafts
SET snapshot = (snapshot - 'listingOverride') || jsonb_build_object(
  'listingState',
  CASE
    WHEN snapshot->>'listingState' IN ('Active', 'Legacy') THEN snapshot->>'listingState'
    WHEN snapshot->>'listingOverride' IN ('Force legacy', 'Legacy') THEN 'Legacy'
    WHEN snapshot->>'listingOverride' IN ('Force active', 'Active') THEN 'Active'
    ELSE 'Active'
  END
);
