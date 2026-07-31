import { NextResponse } from "next/server";
import { z } from "zod";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@/lib/supabase/server";
import { presignGet, R2_BUCKET, r2Client } from "@/lib/r2";
import { probeVideo } from "@/lib/video/ffmpeg";
import { MUSIC_MOODS } from "@/lib/resources/music";

// 音樂資源庫:列出 / 新增(上傳完成後登記) / 修改 / 刪除
export const maxDuration = 60;

const MOOD_IDS = MUSIC_MOODS.map((m) => m.id) as [string, ...string[]];

async function requireCreator() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: "請先登入" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "creator") {
    return { ok: false as const, status: 403, error: "僅站主可使用" };
  }
  return { ok: true as const, supabase, user };
}

export async function GET() {
  const guard = await requireCreator();
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { data, error } = await guard.supabase
    .from("music_library")
    .select("*")
    .eq("creator_id", guard.user.id)
    .order("mood", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    // 資料表尚未建立(migration 未執行)時回空清單,不讓頁面壞掉
    return NextResponse.json({ tracks: [], needsMigration: true });
  }
  return NextResponse.json({ tracks: data ?? [] });
}

const createSchema = z.object({
  key: z.string().min(3).max(500),
  title: z.string().min(1).max(120),
  mood: z.enum(MOOD_IDS),
  artist: z.string().max(120).optional(),
  genre: z.string().max(60).optional(),
});

export async function POST(request: Request) {
  const guard = await requireCreator();
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const json = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "參數有誤" }, { status: 400 });
  }
  const { key, title, mood, artist, genre } = parsed.data;
  if (!key.startsWith("music/")) {
    return NextResponse.json({ error: "檔案路徑有誤" }, { status: 400 });
  }

  // 自動偵測時長(失敗不阻擋登記)
  let durationSec: number | null = null;
  try {
    const url = await presignGet(key, 600);
    const info = await probeVideo(url);
    if (info.durationSec > 0) {
      durationSec = Math.round(info.durationSec * 10) / 10;
    }
  } catch {}

  const { data, error } = await guard.supabase
    .from("music_library")
    .insert({
      creator_id: guard.user.id,
      title,
      artist: artist || null,
      mood,
      genre: genre || null,
      duration_sec: durationSec,
      file_url: `/api/media/${key}`,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "登記失敗;若是第一次使用,請先執行 SQL 卡片 10。" },
      { status: 500 }
    );
  }
  return NextResponse.json({ track: data });
}

const updateSchema = z.object({
  id: z.uuid(),
  title: z.string().min(1).max(120).optional(),
  artist: z.string().max(120).nullable().optional(),
  mood: z.enum(MOOD_IDS).optional(),
  genre: z.string().max(60).nullable().optional(),
  is_active: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  const guard = await requireCreator();
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const json = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "參數有誤" }, { status: 400 });
  }
  const { id, ...fields } = parsed.data;

  const { data, error } = await guard.supabase
    .from("music_library")
    .update(fields)
    .eq("id", id)
    .eq("creator_id", guard.user.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: "更新失敗,請稍後再試" }, { status: 500 });
  }
  return NextResponse.json({ track: data });
}

export async function DELETE(request: Request) {
  const guard = await requireCreator();
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "參數有誤" }, { status: 400 });
  }

  const { data: track } = await guard.supabase
    .from("music_library")
    .select("file_url")
    .eq("id", id)
    .eq("creator_id", guard.user.id)
    .maybeSingle();

  const { error } = await guard.supabase
    .from("music_library")
    .delete()
    .eq("id", id)
    .eq("creator_id", guard.user.id);
  if (error) {
    return NextResponse.json({ error: "刪除失敗,請稍後再試" }, { status: 500 });
  }

  // 一併清掉 R2 檔案(盡力而為)
  const marker = "/api/media/";
  if (track?.file_url?.startsWith(marker)) {
    try {
      await r2Client().send(
        new DeleteObjectCommand({
          Bucket: R2_BUCKET,
          Key: track.file_url.slice(marker.length),
        })
      );
    } catch {}
  }

  return NextResponse.json({ ok: true });
}
