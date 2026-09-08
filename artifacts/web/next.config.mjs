/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:5001/api/:path*",
      },
      {
        source: "/admin/:path*",
        destination: "http://localhost:5001/admin/:path*",
      },
    ];
  },
};

export default nextConfig;