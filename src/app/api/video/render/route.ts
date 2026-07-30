import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { z } from "zod";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@/lib/supabase/server";
import { presignGet, R2_BUCKET, r2Client } from "@/lib/r2";
import { probeVideo, renderEdit } from "@/lib/video/ffmpeg";
import { BEAUTY_LEVELS, FILTER_PRESETS } from "@/lib/video/presets";
import { CAPTION_FONTS, fontById } from "@/lib/video/fonts";
import { CAPTION_STYLES, renderCaptionPng } from "@/lib/video/caption";

// 產生成品影片:縮時 + 直式構圖 + 風格濾鏡 + 轉場 + 美術字幕 + 背景音樂
// 注意:Vercel Hobby 方案函式上限 60 秒,長素材請提高倍速
export const maxDuration = 60;

const FONT_DIR = path.join(process.cwd(), "src/assets/fonts");

const bodySchema = z.object({
  projectId: z.uuid(),
  sourceKey: z.string().min(3).max(500),
  speed: z.union([z.literal(1), z.literal(2), z.literal(4), z.literal(8)]),
  caption: z.string().max(60).optional().default(""),
  captionStyle: z
    .enum(Object.keys(CAPTION_STYLES) as [string, ...string[]])
    .optional()
    .default("classic"),
  captionFont: z
    .enum(CAPTION_FONTS.map((f) => f.id) as [string, ...string[]])
    .optional()
    .default("huninn"),
  effect: z
    .enum(FILTER_PRESETS.map((p) => p.id) as [string, ...string[]])
    .optional()
    .default("none"),
  beauty: z
    .enum(BEAUTY_LEVELS.map((b) => b.id) as [string, ...string[]])
    .optional()
    .default("off"),
  transition: z.enum(["none", "fade", "zoom"]).optional().default("fade"),
  musicKey: z.string().min(3).max(500).optional(),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "參數有誤" }, { status: 400 });
  }
  const {
    projectId,
    sourceKey,
    speed,
    caption,
    captionStyle,
    captionFont,
    effect,
    beauty,
    transition,
    musicKey,
  } = parsed.data;

  if (!sourceKey.startsWith(`projects/${projectId}/slots/`)) {
    return NextResponse.json({ error: "素材與專案不符" }, { status: 400 });
  }
  if (
    musicKey &&
    !musicKey.startsWith("music/") &&
    !musicKey.startsWith(`projects/${projectId}/music/`)
  ) {
    return NextResponse.json({ error: "音樂來源有誤" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "請先登入" }, { status: 401 });
  }

  const { data: project } = await supabase
    .from("edit_projects")
    .select("id, status")
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

  await supabase
    .from("edit_projects")
    .update({
      status: "rendering",
      render_progress: 10,
      error_message: null,
      edit_config: {
        source_key: sourceKey,
        speed,
        caption,
        caption_style: captionStyle,
        caption_font: captionFont,
        effect,
        beauty,
        transition,
        music_key: musicKey ?? null,
      },
    })
    .eq("id", projectId)
    .eq("creator_id", user.id);

  let captionPngPath: string | null = null;

  try {
    const videoUrl = await presignGet(sourceKey, 3600);
    const info = await probeVideo(videoUrl);
    if (info.durationSec <= 0) {
      throw new Error("讀不到素材長度,請重新上傳影片");
    }

    // 美術字幕:先畫成透明 PNG,再由 ffmpeg 疊上(不依賴 drawtext)
    if (caption.trim()) {
      const { buffer } = await renderCaptionPng({
        text: caption,
        fontPath: path.join(FONT_DIR, fontById(captionFont).file),
        style: captionStyle,
      });
      captionPngPath = path.join(
        os.tmpdir(),
        `gs-caption-${crypto.randomUUID()}.png`
      );
      await fs.writeFile(captionPngPath, buffer);
    }

    const musicUrl = musicKey ? await presignGet(musicKey, 3600) : null;
    const outPath = await renderEdit({
      videoUrl,
      sourceDurationSec: info.durationSec,
      speed,
      effect,
      beauty,
      transition,
      captionPngPath,
      musicUrl,
    });

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
  } finally {
    if (captionPngPath) await fs.unlink(captionPngPath).catch(() => {});
  }
}
