import { NextResponse } from "next/server";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { createClient } from "@/lib/supabase/server";
import { R2_BUCKET, r2Client } from "@/lib/r2";

// 共用音樂庫:列出 R2 `music/` 底下的曲目(限站主)
export async function GET() {
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

  try {
    const result = await r2Client().send(
      new ListObjectsV2Command({
        Bucket: R2_BUCKET,
        Prefix: "music/",
        MaxKeys: 100,
      })
    );

    const tracks = (result.Contents ?? [])
      .filter((obj) => obj.Key && obj.Key !== "music/")
      .map((obj) => {
        const key = obj.Key!;
        // music/{8碼}-{名稱}.mp3 → 顯示名稱
        const fileName = key.slice("music/".length).replace(/\.[^.]+$/, "");
        const label = fileName.replace(/^[0-9a-f]{8}-/, "").replace(/-/g, " ");
        return { key, label: label || fileName };
      });

    return NextResponse.json({ tracks });
  } catch {
    return NextResponse.json({ tracks: [] });
  }
}
