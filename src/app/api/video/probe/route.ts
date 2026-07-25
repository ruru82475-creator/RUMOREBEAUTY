import { NextResponse } from "next/server";
import { z } from "zod";
import { presignGet } from "@/lib/r2";
import { probeVideo } from "@/lib/video/ffmpeg";
import { requireCreatorForKey } from "@/lib/video/access";

// 取得影片基本資訊(時長、解析度)
// 時長不足 min_duration 時前端可直接退回,不呼叫 AI 省配額
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
    return NextResponse.json(info);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "影片解析失敗,請稍後再試";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
