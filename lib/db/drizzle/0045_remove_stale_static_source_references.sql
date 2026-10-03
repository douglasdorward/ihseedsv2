-- One-time cleanup: an earlier static-site scan recorded hard-coded placeholder
-- images as "Static source literal" uses. Nothing creates or clears these rows
-- any more, so they blocked deleting those images from the library.
DELETE FROM ih_media_references
WHERE owner_type = 'static' AND field = 'Static source literal';
