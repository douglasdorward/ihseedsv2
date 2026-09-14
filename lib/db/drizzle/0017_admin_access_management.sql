-- Pending approvals are claimable only by a matching verified Clerk primary
-- email. Revocations are durable tombstones so an old bootstrap allowlist
-- cannot silently recreate an administrator after access is removed.
CREATE TABLE IF NOT EXISTS ih_admin_pending_approvals (
  email text PRIMARY KEY NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS ih_admin_revocations (
  email text PRIMARY KEY NOT NULL,
  clerk_user_id text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS ih_admin_access_audit (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_clerk_user_id text NOT NULL,
  actor_email text NOT NULL,
  target_email text NOT NULL,
  action text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS ih_admin_access_audit_created_idx
ON ih_admin_access_audit (created_at);