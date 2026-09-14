/** @type {import('next').NextConfig} */
const wordpressRedirects = [
  ["/lucerne", "/products/lucerne"],
  ["/serradella", "/products/serradella"],
  ["/sub-tropical", "/products/sub-tropical-grasses"],
  ["/other-grasses", "/products/fescues-other-grasses"],
  ["/forage-crops", "/products/forage-grain-crops"],
  ["/perennial-herbs", "/products/herbs"],
  ["/pasture-mixes", "/products/mixes"],
  ["/subterranean-clovers", "/products/clovers"],
  ["/aerial-seeded-clovers", "/products/clovers"],
  ["/white-clovers", "/products/clovers"],
  ["/biennial-ryegrass", "/products/ryegrass"],
  ["/perennial-ryegrasses", "/products/ryegrass"],
  ["/annual-ryegrass", "/products/ryegrass"],
  ["/pasture-seed-guide", "/guide"],
  ["/current-availability-of-our-seeds", "/availability"],
  ["/news", "/resources"],
  ["/articles", "/resources"],
  ["/publications", "/resources"],
  ["/research-site", "/resources"],
  ["/about-us", "/about"],
  ["/products-and-services", "/products"],
  ["/rainfall-map", "/guide"],
  ["/terms-and-conditions", "/contact"],
  ["/privacy", "/contact"],
].flatMap(([source, destination]) => [
  { source, destination, permanent: true },
  { source: `${source}/`, destination, permanent: true },
]);

const nextConfig = {
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
