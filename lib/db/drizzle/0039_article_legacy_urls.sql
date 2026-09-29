ALTER TABLE "ih_articles" ALTER COLUMN "website_url_legacy" DROP DEFAULT;

ALTER TABLE "ih_articles"
  ALTER COLUMN "website_url_legacy" TYPE text[]
  USING (
    CASE
      WHEN btrim("website_url_legacy") = '' THEN '{}'::text[]
      ELSE ARRAY["website_url_legacy"]
    END
  );

ALTER TABLE "ih_articles" ALTER COLUMN "website_url_legacy" SET DEFAULT '{}';
ALTER TABLE "ih_articles" ALTER COLUMN "website_url_legacy" SET NOT NULL;
