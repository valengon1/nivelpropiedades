import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "mclnbxiwmoilpjczuwpy.supabase.co" },
      { protocol: "https", hostname: "static.kiteprop.com" },
      { protocol: "https", hostname: "**.kiteprop.com" },
    ],
  },
};

export default nextConfig;
