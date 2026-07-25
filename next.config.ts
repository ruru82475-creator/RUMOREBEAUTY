import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ffmpeg 相關套件含原生執行檔,不可被 bundler 打包
  serverExternalPackages: [
    "fluent-ffmpeg",
    "ffmpeg-static",
    "ffprobe-static",
    "sharp",
  ],
  // 影片相關 API 在雲端執行時需要:ffmpeg/ffprobe 執行檔與中文字型檔
  outputFileTracingIncludes: {
    "/api/video/**": [
      "./node_modules/ffmpeg-static/**",
      "./node_modules/ffprobe-static/bin/linux/**",
      "./src/assets/fonts/**",
    ],
  },
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
