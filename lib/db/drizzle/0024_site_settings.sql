CREATE TABLE IF NOT EXISTS "ih_site_settings" (
  "id" integer PRIMARY KEY,
  "homepage" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "seed_guide" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

INSERT INTO "ih_site_settings" ("id", "homepage", "seed_guide")
VALUES (
  1,
  '{
    "heroImageSrc": "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=900&q=80",
    "heroImageAssetId": null,
    "heroEyebrow": "Western Australia''s",
    "heroHeading": "Pasture Seed Specialists",
    "heroBody": "Independently owned since 1966. We source, test and blend {productCount} for every region of the state — from Esperance to Derby.",
    "bestSellerSlugs": []
  }'::jsonb,
  '{
    "navTitle": "Seed Guide 2026",
    "cardHeading": "Regional advice, sowing rates and seasonal planning in one place.",
    "cardButtonLabel": "Download the 2026 Pasture Seed Guide (PDF)",
    "cardImageSrc": "https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=900&q=80",
    "cardImageAssetId": null,
    "pdfFilename": "",
    "pdfStorageKey": "",
    "pageTitle": "2026 Pasture Seed Guide",
    "pageIntro": "The definitive resource for Western Australian pasture planning. Sowing rates, rainfall zones and species notes for every mix and variety we stock, in one download.",
    "pageButtonLabel": "Download PDF Guide"
  }'::jsonb
)
ON CONFLICT ("id") DO NOTHING;
