import { spawnSync } from "node:child_process";

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlArray(values) {
  return `ARRAY[${values.map(sqlLiteral).join(", ")}]::text[]`;
}

const articles = [
  {
    slug: "annual-or-perennial-ryegrass",
    title: "Annual or perennial ryegrass?",
    excerpt: "A practical way to choose ryegrass type for Western Australian rainfall, grazing pressure and how long the paddock needs to last.",
    tags: ["Sowing & Timing", "Regional Advice"],
    heroImageSrc: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1400&q=80",
    relatedProductSlugs: ["abundant-tetraploid", "astound", "safeguard-annual-ryegrass"],
    publishedAt: "2026-09-03T02:00:00.000Z",
    seoTitle: "Annual or perennial ryegrass | IH Seeds",
    seoDescription: "Choose annual or perennial ryegrass for WA rainfall, winter feed and paddock life, with sowing notes from IH Seeds.",
    body: `
<h2>Start with the paddock, not the bag</h2>
<p>Ryegrass does different jobs. An annual type is there to make winter and spring feed, then make room for the next crop or renovation. A perennial type is there to persist, fill feed gaps and reduce how often you re-sow.</p>
<p>In Western Australia the useful split is usually rainfall, summer moisture and how hard the paddock is grazed. If the stand has to earn its keep in one growing season, annual tetraploids are the reliable first call. If you want two or more years, look at perennial and hybrid options and be honest about summer survival.</p>
<h3>When annual ryegrass is the better fit</h3>
<ul>
<li>Medium to high rainfall or irrigation, with a clear winter feed target.</li>
<li>Short-term pasture before a crop, or a paddock you renovate often.</li>
<li>You need quick establishment and strong late-winter growth.</li>
</ul>
<h3>When perennial ryegrass is worth the extra care</h3>
<ul>
<li>Higher rainfall or a site that holds summer moisture.</li>
<li>You can manage grazing so plants are not grazed into the ground over summer.</li>
<li>You want a longer stand and are prepared to manage weeds in year two.</li>
</ul>
<blockquote>If ARGT is a live risk on the farm, start with a resistant annual such as Safeguard and build the rest of the mix around it.</blockquote>
<p>Sowing rate, seedbed and opening rains still decide the result. Use the tech sheet for the variety, then <a href="/contact">contact us</a> if you want the mix checked for your rainfall zone.</p>
`.trim(),
  },
  {
    slug: "argt-risk-and-safeguard-ryegrass",
    title: "Cutting ARGT risk in ryegrass paddocks",
    excerpt: "Annual ryegrass toxicity is still a live risk on many WA farms. Resistant ryegrass and careful grazing reduce the chance of a bad season becoming a stock problem.",
    tags: ["Editorial", "Feed Planning"],
    heroImageSrc: "https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=1400&q=80",
    relatedProductSlugs: ["safeguard-annual-ryegrass", "self-regeneration-pasture-mix"],
    publishedAt: "2026-09-08T02:00:00.000Z",
    seoTitle: "Cutting ARGT risk in ryegrass | IH Seeds",
    seoDescription: "How Safeguard ryegrass and paddock management reduce annual ryegrass toxicity risk for Western Australian livestock.",
    body: `
<h2>Why ARGT still matters</h2>
<p>Annual ryegrass toxicity comes from a bacterium carried by a nematode in ryegrass seedheads. Livestock that graze toxic ryegrass can show staggers, collapse and, in bad cases, death. The risk is highest where annual ryegrass runs to head in late spring and stock are left on it.</p>
<p>You cannot spray your way out of a paddock that is already heading. The practical controls are variety choice, grazing timing and not letting a susceptible ryegrass dominate the seedbank.</p>
<h3>What Safeguard changes</h3>
<p><strong>Safeguard</strong> is an annual ryegrass selected for ARGT resistance. It still has to be sown into a clean seedbed and managed like any other ryegrass, but it lowers the chance that the ryegrass itself becomes the toxic species in the paddock.</p>
<ul>
<li>Use it where ARGT has been confirmed, or where neighbours have had cases.</li>
<li>Do not mix it with unknown ryegrass that may reintroduce a susceptible seedbank.</li>
<li>Grazing still needs to keep seedheads in check through spring.</li>
</ul>
<h3>Management that sits beside the seed</h3>
<p>Resistant ryegrass is one tool. Keep fencing and water so mobs can be moved before ryegrass haying-off. If you need a longer pasture, a self-regenerating mix built on resistant ryegrass is usually safer than hoping a volunteer stand stays clean.</p>
<p>If you are unsure whether a paddock is an ARGT site, talk to your reseller or <a href="/contact">get in touch</a> before the sowing window closes.</p>
`.trim(),
  },
  {
    slug: "getting-value-from-sub-clover",
    title: "Getting value from subterranean clover",
    excerpt: "Sub clover still underpins many WA pastures. Matching cultivar to rainfall and hard-seededness is what makes a stand regenerate instead of fading after year one.",
    tags: ["Regional Advice", "Feed Planning"],
    heroImageSrc: "https://images.unsplash.com/photo-1500595046743-cd271d694d30?auto=format&fit=crop&w=1400&q=80",
    relatedProductSlugs: ["urana-sub-clover", "riverina-sub-clover"],
    publishedAt: "2026-09-11T02:00:00.000Z",
    seoTitle: "Getting value from sub clover | IH Seeds",
    seoDescription: "Choose subterranean clover cultivars for WA rainfall and regeneration, including Urana and Riverina from IH Seeds.",
    body: `
<h2>Clover is the nitrogen engine</h2>
<p>Subterranean clover earns its place by fixing nitrogen, filling winter feed and setting seed in the soil so the pasture can come back. A ryegrass-only paddock looks strong in year one and then asks more of fertiliser and the seed cart.</p>
<p>The cultivar decision is mostly rainfall, maturity and hard-seededness. Earlier types suit shorter seasons. Harder-seeded types hold a seedbank through a failed spring or a crop year.</p>
<h3>Match maturity to the season</h3>
<ul>
<li>Lower rainfall and shorter springs need earlier flowering so seed is set before moisture runs out.</li>
<li>Longer seasons can carry later types and keep quality later into spring.</li>
<li>Do not sow a late cultivar into a short-season paddock and expect a seedbank.</li>
</ul>
<h3>Keep the seedbank working</h3>
<p>Hard-seeded cultivars such as <strong>Urana</strong> and proven types such as <strong>Riverina</strong> are useful where you want regeneration after cropping or a dry spring. Inoculate with the correct group, sow shallow, and avoid burying seed in a fluffy seedbed.</p>
<blockquote>Clover fails more often from sowing depth and a dry finish than from the wrong brand on the bag.</blockquote>
<p>If the paddock also needs ryegrass or herbs, we can blend to the rainfall zone. <a href="/contact">Ask for a mix recommendation</a> rather than stacking every legume in the shed.</p>
`.trim(),
  },
  {
    slug: "summer-cover-crops-after-harvest",
    title: "Summer cover crops after harvest",
    excerpt: "A summer mix can turn stubbles into feed, protect soil and give mixed farms a forage option before the next autumn sowing.",
    tags: ["Feed Planning", "Regional Advice"],
    heroImageSrc: "https://images.unsplash.com/photo-1530507629858-e4977d30e9e0?auto=format&fit=crop&w=1400&q=80",
    relatedProductSlugs: ["cover-crop-plus-summer-mix", "teff-grass"],
    publishedAt: "2026-09-14T02:00:00.000Z",
    seoTitle: "Summer cover crops after harvest | IH Seeds",
    seoDescription: "Use summer cover crop mixes and teff to turn WA stubbles into forage while protecting soil between harvest and autumn sowing.",
    body: `
<h2>Use the gap, do not just wait for April</h2>
<p>After harvest many mixed farms have soil, leftover moisture and a feed gap. A summer cover crop is not a miracle in a dry year, but where there is soil moisture it can grow bulk, keep ground covered and give livestock something better than bare stubble.</p>
<p>The mix has to fit the machinery, the livestock and how soon you need the paddock back for autumn pasture or a winter crop.</p>
<h3>What a summer mix is for</h3>
<ul>
<li>Quick forage for cattle or sheep while pasture paddocks recover.</li>
<li>Ground cover to slow erosion and keep soil cooler.</li>
<li>A break from a continuous cereal rotation without locking the paddock up for years.</li>
</ul>
<h3>Keep it simple</h3>
<p><strong>Cover Crop Plus Summer Mix</strong> is built for that job. On lighter country, or where you want a single species that can still make hay, <strong>teff</strong> is a clean option if sowing is timely and weeds are controlled.</p>
<p>Do not sow into a profile that is already empty and hope for thunderstorms. If the paddock is going back to pasture in autumn, plan the termination date now so residue and soil moisture are ready for the opening rains.</p>
<p>Sowing rates change with seed size and whether you are grazing or making hay. Check the tech sheet, then <a href="/contact">talk to us</a> if the paddock has to serve livestock and next winter's crop.</p>
`.trim(),
  },
  {
    slug: "silage-and-hay-mixes-that-pay",
    title: "Silage and hay mixes that pay",
    excerpt: "Conserved feed is only cheap if the mix yields, dries and still has quality. Choose ryegrass and clover for the job, not just the cheapest bag in the shed.",
    tags: ["Feed Planning", "Sowing & Timing"],
    heroImageSrc: "https://images.unsplash.com/photo-1499529112087-3cb3b73cec95?auto=format&fit=crop&w=1400&q=80",
    relatedProductSlugs: ["silahay-mix", "maximix"],
    publishedAt: "2026-09-16T02:00:00.000Z",
    seoTitle: "Silage and hay mixes that pay | IH Seeds",
    seoDescription: "How to choose ryegrass and clover mixes for silage and hay in Western Australia, including Silahay and MaxiMix.",
    body: `
<h2>Yield is not the only number</h2>
<p>A silage or hay paddock has to grow bulk, stand up to a mower and still feed well. A cheap ryegrass that lodges, or a mix that will not dry, costs more in the stack than it saved on the invoice.</p>
<p>Decide first whether the paddock is a dedicated forage crop or a grazing paddock you also want to cut. That choice drives ryegrass type, clover content and sowing rate.</p>
<h3>Dedicated forage</h3>
<p>For a paddock that is sown to cut, a lower-cost ryegrass and clover blend such as <strong>Silahay</strong> is built for bulk and a clean harvest. Keep weeds out early. A dirty hay paddock is a quality problem you cannot fix at baling.</p>
<h3>Grazing plus a spring cut</h3>
<p>If the paddock also has to carry stock, a more complete pasture mix such as <strong>MaxiMix</strong> usually holds density better after grazing. You trade a little peak yield for a paddock that does not fall over once the mower leaves.</p>
<ul>
<li>Set closing dates so spring growth is there to cut.</li>
<li>Do not graze so hard in winter that the ryegrass never recovers.</li>
<li>Match sowing rate to whether the stand is monoculture or in a mix.</li>
</ul>
<blockquote>The mix should suit the paddock it is going into, not the leftover seed in the shed.</blockquote>
<p>We blend for the region and the job. If you need a stack for the dairy, feedlot or a dry autumn, <a href="/contact">send the paddock details</a> and we will check the mix before you order.</p>
`.trim(),
  },
];

const statements = articles.map((article) => `
INSERT INTO ih_articles (
  slug, title, excerpt, body, tags, hero_image_src, related_product_slugs,
  publish_status, published_at, seo_title, seo_description, robots_index, updated_at
) VALUES (
  ${sqlLiteral(article.slug)},
  ${sqlLiteral(article.title)},
  ${sqlLiteral(article.excerpt)},
  ${sqlLiteral(article.body)},
  ${sqlArray(article.tags)},
  ${sqlLiteral(article.heroImageSrc)},
  ${sqlLiteral(JSON.stringify(article.relatedProductSlugs))}::jsonb,
  'Published',
  ${sqlLiteral(article.publishedAt)}::timestamptz,
  ${sqlLiteral(article.seoTitle)},
  ${sqlLiteral(article.seoDescription)},
  true,
  now()
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  excerpt = EXCLUDED.excerpt,
  body = EXCLUDED.body,
  tags = EXCLUDED.tags,
  hero_image_src = EXCLUDED.hero_image_src,
  related_product_slugs = EXCLUDED.related_product_slugs,
  publish_status = 'Published',
  published_at = COALESCE(ih_articles.published_at, EXCLUDED.published_at),
  seo_title = EXCLUDED.seo_title,
  seo_description = EXCLUDED.seo_description,
  robots_index = true,
  updated_at = now();
`.trim());

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set.");
}

const result = spawnSync("psql", [process.env.DATABASE_URL, "-v", "ON_ERROR_STOP=1", "-c", statements.join("\n")], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});
if (result.status !== 0) {
  process.stderr.write(result.stderr || "psql failed\n");
  process.exit(result.status ?? 1);
}
process.stdout.write(`Inserted or updated ${articles.length} example articles.\n`);
