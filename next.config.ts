import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // 作品圖片來源:Supabase Storage 與 Cloudflare R2
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "**.r2.dev" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
