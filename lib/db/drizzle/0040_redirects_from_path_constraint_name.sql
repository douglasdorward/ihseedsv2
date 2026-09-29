-- Older databases created the redirect source-path uniqueness rule with
-- PostgreSQL's default name, while the schema expects Drizzle's name. The
-- mismatch made schema pushes offer to truncate the redirects table. Rename the
-- existing rule in place so no redirect data is touched.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'ih_redirects'::regclass
      AND conname = 'ih_redirects_from_path_key'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'ih_redirects'::regclass
      AND conname = 'ih_redirects_from_path_unique'
  ) THEN
    ALTER TABLE "ih_redirects"
      RENAME CONSTRAINT "ih_redirects_from_path_key" TO "ih_redirects_from_path_unique";
  END IF;
END $$;
