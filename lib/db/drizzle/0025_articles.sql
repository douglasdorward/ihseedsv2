CREATE TABLE IF NOT EXISTS "ih_articles" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "slug" text NOT NULL,
  "title" text NOT NULL,
  "excerpt" text NOT NULL DEFAULT '',
  "body" text NOT NULL DEFAULT '',
  "tags" text[] NOT NULL DEFAULT '{}'::text[],
  "hero_image_src" text NOT NULL DEFAULT '',
  "hero_image_asset_id" text,
  "related_product_slugs" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "publish_status" text NOT NULL DEFAULT 'Draft',
  "published_at" timestamp with time zone,
  "seo_title" text NOT NULL DEFAULT '',
  "seo_description" text NOT NULL DEFAULT '',
  "social_title" text NOT NULL DEFAULT '',
  "social_description" text NOT NULL DEFAULT '',
  "social_image" text NOT NULL DEFAULT '',
  "robots_index" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "ih_articles_slug_unique" ON "ih_articles" ("slug");
