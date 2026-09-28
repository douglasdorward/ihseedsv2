import { canonicalHostRedirects } from "./host-redirect.mjs";

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
  experimental: {
    inlineCss: true,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 2678400,
    // A relative /api/media src is not a file in public/, and the optimiser's
    // internal request does not receive image bytes through the rewrite.
    // CoverImage points src at this origin so the optimiser fetches Express directly.
    remotePatterns: [
      { protocol: "http", hostname: "127.0.0.1", port: "8080", pathname: "/api/media/**" },
      { protocol: "http", hostname: "localhost", port: "8080", pathname: "/api/media/**" },
      { protocol: "http", hostname: "127.0.0.1", port: "8080", pathname: "/api/site/**" },
      { protocol: "http", hostname: "localhost", port: "8080", pathname: "/api/site/**" },
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
      { protocol: "https", hostname: "irwinhunter.com.au", pathname: "/**" },
      { protocol: "https", hostname: "www.irwinhunter.com.au", pathname: "/**" },
    ],
  },
  typescript: {
    tsconfigPath: process.env.NEXT_TSCONFIG_PATH || "tsconfig.json",
  },
  async redirects() {
    // Host canonicalisation runs first so a legacy apex URL lands on www in
    // one hop before the path redirect below is applied.
    return [...canonicalHostRedirects(), ...wordpressRedirects];
  },
  async headers() {
    const immutable = [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }];
    const security = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), payment=(), usb=()" },
    ];
    return [
      { source: "/asf-accredited-224.webp", headers: immutable },
      { source: "/celebrating-60-years-580.webp", headers: immutable },
      { source: "/:path*", headers: security },
    ];
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
