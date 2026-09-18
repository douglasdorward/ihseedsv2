UPDATE "ih_reseller_brands"
SET "logo_src" = '/uploads/site/nutrien-logo.webp',
    "updated_at" = now()
WHERE "kind" = 'nutrien'
  AND coalesce("logo_src", '') = '';
