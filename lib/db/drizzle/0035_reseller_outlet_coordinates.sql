ALTER TABLE "ih_reseller_outlets"
  ADD COLUMN IF NOT EXISTS "latitude" double precision,
  ADD COLUMN IF NOT EXISTS "longitude" double precision;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ih_reseller_outlets_coordinates_pair'
  ) THEN
    ALTER TABLE "ih_reseller_outlets"
      ADD CONSTRAINT "ih_reseller_outlets_coordinates_pair"
      CHECK (
        ("latitude" IS NULL AND "longitude" IS NULL)
        OR (
          "latitude" IS NOT NULL
          AND "longitude" IS NOT NULL
          AND "latitude" BETWEEN -90 AND 90
          AND "longitude" BETWEEN -180 AND 180
        )
      );
  END IF;
END $$;
