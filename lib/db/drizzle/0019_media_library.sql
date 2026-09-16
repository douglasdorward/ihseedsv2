CREATE TABLE IF NOT EXISTS ih_media_assets (
  id text PRIMARY KEY NOT NULL,
  status text NOT NULL DEFAULT 'Pending',
  original_filename text NOT NULL,
  content_type text,
  bytes integer,
  width integer,
  height integer,
  sha256 text,
  default_alt text NOT NULL DEFAULT '',
  default_caption text NOT NULL DEFAULT '',
  failure_reason text,
  storage_kind text NOT NULL DEFAULT 'managed',
  object_path text,
  staging_path text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ih_media_assets_sha256_ready_unique
ON ih_media_assets (sha256)
WHERE status = 'Ready' AND sha256 IS NOT NULL;

CREATE TABLE IF NOT EXISTS ih_media_references (
  id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  asset_id text NOT NULL REFERENCES ih_media_assets(id) ON DELETE CASCADE,
  owner_type text NOT NULL,
  owner_id text NOT NULL,
  owner_name text NOT NULL DEFAULT '',
  field text NOT NULL DEFAULT 'details.photos',
  role text NOT NULL DEFAULT '',
  usage_state text NOT NULL,
  edit_path text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ih_media_references_asset_id_idx ON ih_media_references (asset_id);
CREATE INDEX IF NOT EXISTS ih_media_references_owner_idx ON ih_media_references (owner_type, owner_id);
