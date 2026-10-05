-- Redirects uploaded by an administrator (Site settings > Legacy URL redirects)
-- are marked so a catalogue workbook import never rebuilds them away. Every
-- redirect that exists today was created by the catalogue, so that is the default.
ALTER TABLE "ih_redirects"
  ADD COLUMN IF NOT EXISTS "source" text NOT NULL DEFAULT 'catalogue';
