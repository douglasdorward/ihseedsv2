-- Listing state "New" was added to the catalogue after existing databases
-- were seeded. Add it to the workbook dropdown list only where the list
-- already exists; an empty database gets it from the seed instead.
INSERT INTO ih_product_options (list_name, value, sort_order)
SELECT 'listing_state', 'New', 1
WHERE EXISTS (SELECT 1 FROM ih_product_options WHERE list_name = 'listing_state')
ON CONFLICT (list_name, value) DO NOTHING;

UPDATE ih_product_options SET sort_order = 2
WHERE list_name = 'listing_state' AND value = 'Legacy' AND sort_order = 1
  AND EXISTS (SELECT 1 FROM ih_product_options WHERE list_name = 'listing_state' AND value = 'New' AND sort_order = 1);

-- Mix component descriptions are now capped at 2,000 characters. One imported
-- description was 2,470 characters of partly repeated guidance, which blocked
-- saving that product in the editor. Replace it only while it still has the
-- exact imported text (md5 guard), so a later administrator edit is never touched.
UPDATE ih_products p
SET details = jsonb_set(
  p.details,
  ARRAY['components', (c.ord - 1)::text, 'description'],
  to_jsonb('Gatton Panic Grass is a medium height bunch grass variety of guinea grass similar to Green Panic. Gatton Panic has broader dark green leaves and smooth stem nodes, is highly adaptable and resilient, with the ability to establish across a wide rainfall zone. Gatton Panic will establish more easily than other panic grasses and can give very good first year production. Gatton Panic can be grown on lighter soil types but requires good soil nutrition to persist. Where practical remove weed burden before sowing. Sow in spring on a well-prepared seedbed when soil temperatures are 16 – 18° C and rising. Sow no deeper than 2cm. It is recommended to shut the gate and only graze after 8 to 10 months or when plants are well anchored. If desired broadcast / sow any additional legumes in the first autumn after grazing, then re-introduce livestock to get seed to soil contact. After the first grazing, move to a rotational grazing system where possible. Perennial pastures need a longer spell between grazing than temperate pastures to grow the herbage (biomass) to achieve the best production outcome. As leaf mass accumulates, perennial / sub-tropical grasses also build root mass and store water-soluble carbohydrates (energy plants use) for later growth, so the biomass and root mass retained after grazing act as a reserve to kick start the next period of leaf growth. Recovery from grazing will vary considerably depending on the time of year, biomass retained after grazing, soil moisture and plant nutrition. Graze at 25 to 30cm and leave a residue of 12 to 15cm. Reduce grazing pressure over summer (unless there is adequate moisture for plant growth), or when seed set is occurring, to allow some plant recruitment through seed set. Soil pH: 5 + Rainfall: 300 mm + Sowing rate: 4 – 8 Kgs/Ha.'::text),
  false
)
FROM (
  SELECT pr.id, t.ord
  FROM ih_products pr,
       jsonb_array_elements(pr.details->'components') WITH ORDINALITY AS t(component, ord)
  WHERE pr.slug = 'northern-perennial-pasture-mix'
    AND jsonb_typeof(pr.details->'components') = 'array'
    AND md5(t.component->>'description') = '6aaa5a18af1d22619d004bbe385fbe62'
) c
WHERE p.id = c.id;
