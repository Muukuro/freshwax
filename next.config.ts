import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/calendar/:token.ics",
        destination: "/calendar/:token",
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn-images.dzcdn.net",
      },
      {
        protocol: "https",
        hostname: "api.deezer.com",
      },
      {
        protocol: "https",
        hostname: "coverartarchive.org",
      },
    ],
  },
};

export default nextConfig;
