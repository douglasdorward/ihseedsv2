ALTER TABLE "ih_admin_users"
  ADD COLUMN IF NOT EXISTS "disabled_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "must_change_password" boolean NOT NULL DEFAULT true;

UPDATE "ih_admin_users"
SET "must_change_password" = false
WHERE "must_change_password" = true;

ALTER TABLE "ih_admin_users"
  DROP CONSTRAINT IF EXISTS "ih_admin_users_role_check";

ALTER TABLE "ih_admin_users"
  ADD CONSTRAINT "ih_admin_users_role_check"
  CHECK ("role" IN ('admin', 'superadmin'));

CREATE UNIQUE INDEX IF NOT EXISTS "ih_admin_users_one_superadmin"
  ON "ih_admin_users" ("role")
  WHERE "role" = 'superadmin';