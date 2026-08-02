import { NextResponse } from "next/server";
import { z } from "zod";
import { presignGet } from "@/lib/r2";
import { extractFrames, probeVideo } from "@/lib/video/ffmpeg";
import { requireCreatorForKey } from "@/lib/video/access";
import { VISUAL_FILTERS } from "@/lib/resources/filters";
import { DECORATIONS } from "@/lib/resources/decorations";
import { SUBTITLE_STYLES } from "@/lib/resources/subtitleStyles";
import { getAIProvider } from "@/lib/ai";
import { tryConsumeAIQuota } from "@/lib/ai/rateLimiter";

// AI 看素材 → 推薦整套後製風格(使用者按下「讓 AI 幫我挑」才會呼叫)
export const maxDuration = 60;

const bodySchema = z.object({
  projectId: z.uuid(),
  key: z.string().min(3).max(500),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "參數有誤" }, { status: 400 });
  }
  const { projectId, key } = parsed.data;

  if (!key.startsWith(`projects/${projectId}/slots/`)) {
    return NextResponse.json({ error: "素材與專案不符" }, { status: 400 });
  }

  const guard = await requireCreatorForKey(key);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const { supabase } = guard;

  const quota = await tryConsumeAIQuota();
  if (!quota.allowed) {
    return NextResponse.json(
      { error: "今日 AI 用量已達上限,請明天再試,或手動挑選風格。" },
      { status: 429 }
    );
  }

  try {
    const { data: templates } = await supabase
      .from("video_templates")
      .select("id, name, description")
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    const url = await presignGet(key);
    const info = await probeVideo(url);
    if (info.durationSec <= 0) {
      throw new Error("讀不到素材長度,請重新上傳影片");
    }

    const frames = await extractFrames(url, info.durationSec);

    const recommendation = await getAIProvider().analyzeAndRecommend({
      images: frames,
      templates: (templates ?? []).map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description ?? "",
      })),
      filters: VISUAL_FILTERS.map((f) => ({
        id: f.id,
        name: f.label,
        description: f.description,
      })),
      decorations: DECORATIONS.filter((d) => d.available).map((d) => ({
        id: d.id,
        name: d.label,
        description: d.description,
      })),
      subtitleStyles: SUBTITLE_STYLES.filter((s) => s.available).map((s) => ({
        id: s.id,
        name: s.label,
        description: s.description,
      })),
    });

    return NextResponse.json(recommendation);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "AI 分析失敗,請稍後再試或手動挑選風格";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
