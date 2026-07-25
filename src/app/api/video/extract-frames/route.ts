import { NextResponse } from "next/server";
import { z } from "zod";
import { presignGet } from "@/lib/r2";
import { extractFrames, probeVideo } from "@/lib/video/ffmpeg";
import { requireCreatorForKey } from "@/lib/video/access";

// 從影片抽取 3 幀代表畫面(10%、50%、90%),輸出 base64 JPEG(512px 寬)
export const maxDuration = 60;

const bodySchema = z.object({
  key: z.string().min(3).max(500),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "參數有誤" }, { status: 400 });
  }

  const guard = await requireCreatorForKey(parsed.data.key);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  try {
    const url = await presignGet(parsed.data.key);
    const info = await probeVideo(url);
    if (info.durationSec <= 0) {
      return NextResponse.json(
        { error: "讀不到影片長度,檔案可能損壞" },
        { status: 422 }
      );
    }
    const frames = await extractFrames(url, info.durationSec);
    return NextResponse.json({ frames, info });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "抽取影格失敗,請稍後再試";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
