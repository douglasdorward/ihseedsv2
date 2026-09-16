-- The replacement workbook is now the only redirect authority.
-- Clear historical, hardcoded, and mutation-generated records; a later
-- catalogue import repopulates only 1 Products.website_url paths.
DELETE FROM ih_redirects;