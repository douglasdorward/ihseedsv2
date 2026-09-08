/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:8080/api/:path*",
      },
      {
        source: "/admin/:path*",
        destination: "http://localhost:8080/admin/:path*",
      },
    ];
  },
};

export default nextConfig;