import { NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient } from "@/lib/supabase/server";
import { R2_BUCKET, r2Client } from "@/lib/r2";

// 媒體讀取:轉址到 R2 預簽名 GET URL
// portfolio/*:公開(作品本來就對外);projects/*:僅 creator(私人拍攝素材)
// 轉址帶 1 小時快取,重複瀏覽不會一直打這支 API
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const { key: parts } = await params;

  if (
    !parts ||
    parts.length < 2 ||
    parts.some((p) => p === "" || p === "." || p === "..")
  ) {
    return NextResponse.json({ error: "路徑有誤" }, { status: 400 });
  }
  const key = parts.join("/");

  if (key.startsWith("portfolio/")) {
    // 公開作品,任何人可讀
  } else if (key.startsWith("projects/")) {
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
      return NextResponse.json({ error: "無權限" }, { status: 403 });
    }
  } else {
    return NextResponse.json({ error: "路徑不存在" }, { status: 404 });
  }

  const url = await getSignedUrl(
    r2Client(),
    new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }),
    { expiresIn: 60 * 60 * 24 * 7 } // 簽名 7 天(上限),搭配短快取自動續簽
  );

  return NextResponse.redirect(url, {
    status: 302,
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
