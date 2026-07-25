import { NextResponse } from "next/server";
import { z } from "zod";
import { presignGet } from "@/lib/r2";
import { extractFrames, probeVideo } from "@/lib/video/ffmpeg";
import { requireCreatorForKey } from "@/lib/video/access";
import { matchSlot } from "@/lib/ai/matchSlot";
import type { SlotUpload, TemplateSlot } from "@/types/video";

// 上傳素材自動歸類:AI 判斷影片屬於哪個空槽位並登記
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
    return NextResponse.json({ error: "檔案與專案不符" }, { status: 400 });
  }

  const guard = await requireCreatorForKey(key);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const { supabase, user } = guard;

  const { data: project } = await supabase
    .from("edit_projects")
    .select("id, slot_uploads, template_id")
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

  const uploads = (project.slot_uploads ?? []) as SlotUpload[];
  const emptySlots = slots.filter(
    (s) => !uploads.some((u) => u.slot_id === s.slot_id && u.validated)
  );
  if (emptySlots.length === 0) {
    return NextResponse.json(
      { error: "所有鏡頭都已有素材,可以直接產生影片了!" },
      { status: 400 }
    );
  }

  try {
    const url = await presignGet(key);
    const info = await probeVideo(url);

    // 抽中段 1 幀給 AI 歸類(便宜快速;AI 不可用/配額用盡時自動用第一個空槽)
    const frames = await extractFrames(url, Math.max(info.durationSec, 0.1), [
      0.5,
    ]);
    const { slot, viaAI } = await matchSlot({
      frames,
      candidates: emptySlots,
    });

    const feedback = viaAI
      ? `AI 已把這段歸類為「${slot.name}」`
      : `已把這段放入「${slot.name}」(AI 助手暫時忙碌,採自動排序)`;

    const nextUploads = [
      ...uploads.filter((u) => u.slot_id !== slot.slot_id),
      {
        slot_id: slot.slot_id,
        r2_key: key,
        duration: Math.round(info.durationSec * 10) / 10,
        validated: viaAI ? true : ("skipped" as const),
        ai_feedback: feedback,
      },
    ];

    const allFilled = slots.every((s) =>
      nextUploads.some((u) => u.slot_id === s.slot_id && u.validated)
    );

    const { error: updateError } = await supabase
      .from("edit_projects")
      .update({
        slot_uploads: nextUploads,
        status: allFilled ? "ready" : "shooting",
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
      slotId: slot.slot_id,
      slotName: slot.name,
      feedback,
      durationSec: Math.round(info.durationSec * 10) / 10,
      filled: nextUploads.filter((u) => u.validated).length,
      total: slots.length,
      allFilled,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "素材處理失敗,請稍後再試";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
