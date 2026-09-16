DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'ih_media_assets'
      AND column_name = 'byte_size'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'ih_media_assets'
      AND column_name = 'bytes'
  ) THEN
    ALTER TABLE ih_media_assets RENAME COLUMN byte_size TO bytes;
  END IF;
END
$$;

ALTER TABLE ih_media_assets
  ADD COLUMN IF NOT EXISTS bytes integer,
  ADD COLUMN IF NOT EXISTS staging_path text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'ih_media_assets'
      AND column_name = 'source_key'
  ) THEN
    ALTER TABLE ih_media_assets ALTER COLUMN source_key DROP NOT NULL;
  END IF;
END
$$;