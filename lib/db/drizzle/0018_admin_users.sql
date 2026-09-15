-- Role rows for verified Clerk identities. CREATE IF NOT EXISTS so environments
-- that already created this table during local recovery stay compatible.
CREATE TABLE IF NOT EXISTS ih_admin_users (
  clerk_user_id text PRIMARY KEY NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'admin',
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ih_admin_users_email_unique ON ih_admin_users (email);
