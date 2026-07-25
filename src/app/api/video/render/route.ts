import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import { z } from "zod";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@/lib/supabase/server";
import { presignGet, R2_BUCKET, r2Client } from "@/lib/r2";
import { renderSlots } from "@/lib/video/ffmpeg";
import type { SlotUpload, TemplateSlot } from "@/types/video";

// 產生成品影片:已有素材的槽位依樣板順序裁切、統一直式規格、串接
// 成品上傳 R2,專案狀態 done
// (目前為 ffmpeg 簡易後製;之後接 Remotion 動畫樣板時替換此層)
export const maxDuration = 300;

const bodySchema = z.object({
  projectId: z.uuid(),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "參數有誤" }, { status: 400 });
  }
  const { projectId } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "請先登入" }, { status: 401 });
  }

  const { data: project } = await supabase
    .from("edit_projects")
    .select("id, status, slot_uploads, template_id")
    .eq("id", projectId)
    .eq("creator_id", user.id)
    .maybeSingle();
  if (!project) {
    return NextResponse.json({ error: "找不到專案" }, { status: 404 });
  }
  if (project.status === "rendering") {
    return NextResponse.json(
      { error: "影片正在後製中,請稍候" },
      { status: 409 }
    );
  }

  const { data: template } = await supabase
    .from("video_templates")
    .select("slots")
    .eq("id", project.template_id)
    .maybeSingle();
  const slots = (template?.slots ?? []) as TemplateSlot[];
  const uploads = (project.slot_uploads ?? []) as SlotUpload[];

  // 依樣板順序取出已有素材的槽位
  const filled = slots.flatMap((slot) => {
    const upload = uploads.find(
      (u) => u.slot_id === slot.slot_id && u.validated
    );
    return upload ? [{ slot, upload }] : [];
  });
  if (filled.length === 0) {
    return NextResponse.json(
      { error: "還沒有任何素材,請先上傳至少一段影片" },
      { status: 400 }
    );
  }

  await supabase
    .from("edit_projects")
    .update({ status: "rendering", render_progress: 10, error_message: null })
    .eq("id", projectId)
    .eq("creator_id", user.id);

  try {
    const items = [];
    for (const { slot, upload } of filled) {
      items.push({
        url: await presignGet(upload.r2_key, 3600),
        durationSec: slot.duration_sec,
      });
    }

    const outPath = await renderSlots(items);
    const buffer = await fs.readFile(outPath);
    await fs.unlink(outPath).catch(() => {});

    const outKey = `projects/${projectId}/output-${Date.now()}.mp4`;
    await r2Client().send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: outKey,
        Body: buffer,
        ContentType: "video/mp4",
      })
    );

    const outputUrl = `/api/media/${outKey}`;
    await supabase
      .from("edit_projects")
      .update({
        status: "done",
        output_url: outputUrl,
        render_progress: 100,
      })
      .eq("id", projectId)
      .eq("creator_id", user.id);

    return NextResponse.json({ ok: true, outputUrl });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "影片後製失敗,請稍後再試";
    await supabase
      .from("edit_projects")
      .update({ status: "failed", error_message: message })
      .eq("id", projectId)
      .eq("creator_id", user.id);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
