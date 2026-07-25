import { NextResponse } from "next/server";
import { z } from "zod";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@/lib/supabase/server";
import { MAX_AUDIO_BYTES, R2_BUCKET, r2Client } from "@/lib/r2";

// 把搜尋到的免費音樂收進音樂庫(下載後存入 R2,之後每個專案都能重複使用)
export const maxDuration = 60;

const bodySchema = z.object({
  url: z.url(),
  title: z.string().min(1).max(60),
});

const EXT_BY_TYPE: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/ogg": "ogg",
  "audio/flac": "flac",
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "請先登入" }, { status: 401 });
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "creator") {
    return NextResponse.json({ error: "僅站主可使用" }, { status: 403 });
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "參數有誤" }, { status: 400 });
  }

  try {
    const res = await fetch(parsed.data.url, {
      headers: { "User-Agent": "GlowStudio/1.0 (creator video tool)" },
    });
    if (!res.ok) {
      throw new Error("下載音樂失敗,請換一首試試");
    }

    const contentType = (res.headers.get("content-type") ?? "")
      .split(";")[0]
      .trim();
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength === 0) {
      throw new Error("音檔內容是空的,請換一首試試");
    }
    if (buffer.byteLength > MAX_AUDIO_BYTES) {
      throw new Error("這首歌檔案太大(超過 20MB),請換一首");
    }

    const ext = EXT_BY_TYPE[contentType] ?? "mp3";
    const safeName = parsed.data.title
      .replace(/[^\p{L}\p{N}\-_ ]/gu, "")
      .trim()
      .slice(0, 40)
      .replace(/\s+/g, "-");
    const key = `music/${crypto.randomUUID().slice(0, 8)}-${safeName || "track"}.${ext}`;

    await r2Client().send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType || "audio/mpeg",
      })
    );

    return NextResponse.json({ key, label: parsed.data.title });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "加入音樂庫失敗,請稍後再試",
      },
      { status: 502 }
    );
  }
}
