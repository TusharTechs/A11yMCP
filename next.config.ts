import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // The partner demo is a plain static HTML page in public/ — served at a
      // clean URL so it reads as a real third-party site, not an app route.
      { source: "/partner", destination: "/partner/index.html" },
    ];
  },
};

export default nextConfig;
