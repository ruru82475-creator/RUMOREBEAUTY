import { NextResponse } from "next/server";

// 暫時性診斷端點:檢查各模組能否在雲端環境載入(問題排除後即移除)
export const maxDuration = 30;

export async function GET() {
  const results: Record<string, string> = {};

  const checks: [string, () => Promise<unknown>][] = [
    ["sharp", () => import("sharp")],
    ["opentype.js", () => import("opentype.js")],
    ["caption", () => import("@/lib/video/caption")],
    ["ffmpeg", () => import("@/lib/video/ffmpeg")],
  ];

  for (const [name, load] of checks) {
    try {
      await load();
      results[name] = "ok";
    } catch (error) {
      results[name] = error instanceof Error ? error.message : String(error);
    }
  }

  // 字型檔是否有被打包進來
  try {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const fontPath = path.join(
      process.cwd(),
      "src/assets/fonts/jf-openhuninn.ttf"
    );
    const stat = await fs.stat(fontPath);
    results.font = `ok (${Math.round(stat.size / 1024)} KB)`;
  } catch (error) {
    results.font = error instanceof Error ? error.message : String(error);
  }

  return NextResponse.json(results);
}
