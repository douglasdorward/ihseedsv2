/** @type {import('next').NextConfig} */
const wordpressRedirects = [
  ["/lucerne", "/products/lucerne"],
  ["/serradella", "/products/serradella"],
  ["/sub-tropical", "/products/sub-tropical-grasses"],
  ["/other-grasses", "/products/fescues-other-grasses"],
  ["/forage-crops", "/products/forage-grain-crops"],
  ["/perennial-herbs", "/products/herbs"],
  ["/pasture-mixes", "/products/mixes"],
  ["/our-mixes-pdf", "/products/mixes"],
  ["/urana-sub-clover", "/products/clovers/urana-sub-clover"],
  ["/subterranean-clovers", "/products/clovers"],
  ["/aerial-seeded-clovers", "/products/clovers"],
  ["/white-clovers", "/products/clovers"],
  ["/biennial-ryegrass", "/products/ryegrass"],
  ["/perennial-ryegrasses", "/products/ryegrass"],
  ["/annual-ryegrass", "/products/ryegrass"],
  ["/pasture-seed-guide", "/guide"],
  ["/pasture-seed-guide-old", "/guide"],
  ["/pasture-seed-guide-2019", "/guide"],
  ["/pasture-seed-guide-2020", "/guide"],
  ["/pasture-seed-guide-2020-middle-pages", "/guide"],
  ["/pasture-seed-guide-2020-back-cover", "/guide"],
  ["/pasture-seed-guide-2021", "/guide"],
  ["/pasture-seed-guide-2023", "/guide"],
  ["/subscription-page", "/guide"],
  ["/current-availability-of-our-seeds", "/availability"],
  ["/current-availability-of-our-seeds-old", "/availability"],
  ["/stock-current-availability", "/availability"],
  ["/news", "/resources"],
  ["/articles", "/resources"],
  ["/publications", "/resources"],
  ["/publications-and-news", "/resources"],
  ["/archived-publications", "/resources"],
  ["/equi1st-pasture-mix-january-2023-update", "/resources"],
  ["/research-site", "/resources"],
  ["/about-us", "/about"],
  ["/products-and-services", "/products"],
  ["/rainfall-map", "/pasture-selector"],
].flatMap(([source, destination]) => [
  { source, destination, permanent: true },
  { source: `${source}/`, destination, permanent: true },
]);

const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  typescript: {
    tsconfigPath: process.env.NEXT_TSCONFIG_PATH || "tsconfig.json",
  },
  async redirects() {
    return wordpressRedirects;
  },
  async rewrites() {
    return [
      {
        source: "/admin",
        destination: "http://localhost:8080/admin",
      },
      {
        source: "/api/:path*",
        destination: "http://localhost:8080/api/:path*",
      },
      {
        source: "/uploads/:path*",
        destination: "http://localhost:8080/uploads/:path*",
      },
      {
        source: "/admin/:path*",
        destination: "http://localhost:8080/admin/:path*",
      },
    ];
  },
};

export default nextConfig;
