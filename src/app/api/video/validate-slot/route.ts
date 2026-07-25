import { NextResponse } from "next/server";
import { z } from "zod";
import { presignGet } from "@/lib/r2";
import { extractFrames, probeVideo } from "@/lib/video/ffmpeg";
import { requireCreatorForKey } from "@/lib/video/access";
import { validateSlot } from "@/lib/ai/validateSlot";
import type { SlotUpload, TemplateSlot } from "@/types/video";

// 槽位素材驗證主流程:
// probe(長度不足直接退回,省 AI 配額)→ 抽 3 幀 → AI 檢查 → 更新專案進度
// 全部槽位合格 → 專案狀態改為 ready
export const maxDuration = 60;

const bodySchema = z.object({
  projectId: z.uuid(),
  slotId: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[\w-]+$/),
  key: z.string().min(3).max(500),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "參數有誤" }, { status: 400 });
  }
  const { projectId, slotId, key } = parsed.data;

  // key 必須正好是這個專案這個槽位的檔案
  if (!key.startsWith(`projects/${projectId}/slots/${slotId}.`)) {
    return NextResponse.json({ error: "檔案與槽位不符" }, { status: 400 });
  }

  const guard = await requireCreatorForKey(key);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const { supabase, user } = guard;

  const { data: project } = await supabase
    .from("edit_projects")
    .select("id, status, slot_uploads, template_id")
    .eq("id", projectId)
    .eq("creator_id", user.id)
    .maybeSingle();
  if (!project) {
    return NextResponse.json({ error: "找不到專案" }, { status: 404 });
  }

  const { data: template } = await supabase
    .from("video_templates")
    .select("slots")
    .eq("id", project.template_id)
    .maybeSingle();
  const slots = (template?.slots ?? []) as TemplateSlot[];
  const slot = slots.find((s) => s.slot_id === slotId);
  if (!slot) {
    return NextResponse.json({ error: "找不到這個槽位" }, { status: 404 });
  }

  try {
    const url = await presignGet(key);
    const info = await probeVideo(url);

    let pass = false;
    let feedback: string;

    if (info.durationSec + 0.05 < slot.validation.min_duration) {
      // 長度不足:直接退回,不呼叫 AI
      feedback = `影片只有 ${info.durationSec.toFixed(1)} 秒,這個鏡頭至少需要 ${slot.validation.min_duration} 秒,請重新拍一段長一點的。`;
    } else {
      const frames = await extractFrames(url, info.durationSec);
      const result = await validateSlot({
        frames,
        slot,
        durationSec: info.durationSec,
      });
      pass = result.pass;
      feedback = result.feedback;
    }

    // 更新 slot_uploads(覆蓋同槽位的舊紀錄)
    const uploads = ((project.slot_uploads ?? []) as SlotUpload[]).filter(
      (u) => u.slot_id !== slotId
    );
    uploads.push({
      slot_id: slotId,
      r2_key: key,
      duration: Math.round(info.durationSec * 10) / 10,
      validated: pass,
      ai_feedback: feedback,
    });

    const allDone = slots.every((s) =>
      uploads.some((u) => u.slot_id === s.slot_id && u.validated)
    );

    const { error: updateError } = await supabase
      .from("edit_projects")
      .update({
        slot_uploads: uploads,
        status: allDone ? "ready" : "shooting",
      })
      .eq("id", projectId)
      .eq("creator_id", user.id);
    if (updateError) {
      return NextResponse.json(
        { error: "進度儲存失敗,請再試一次" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      pass,
      feedback,
      durationSec: Math.round(info.durationSec * 10) / 10,
      allDone,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "驗證失敗,請稍後再試";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
