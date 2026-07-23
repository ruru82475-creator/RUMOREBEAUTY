import { NextResponse } from "next/server";
import { z } from "zod";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient } from "@/lib/supabase/server";
import {
  ALLOWED_UPLOAD_TYPES,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  R2_BUCKET,
  r2Client,
} from "@/lib/r2";

// 產生 R2 預簽名 PUT URL(10 分鐘有效)
// 僅 creator 可用;檔案格式與大小簽進授權,拿到授權也無法傳別的東西
const bodySchema = z.discriminatedUnion("purpose", [
  z.object({
    purpose: z.literal("portfolio"),
    contentType: z.string(),
    size: z.number().int().positive(),
  }),
  z.object({
    purpose: z.literal("slot_upload"),
    contentType: z.string(),
    size: z.number().int().positive(),
    projectId: z.uuid(),
    slotId: z
      .string()
      .min(1)
      .max(50)
      .regex(/^[\w-]+$/, "slotId 格式有誤"),
  }),
]);

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
    return NextResponse.json({ error: "僅站主可上傳" }, { status: 403 });
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "參數有誤" }, { status: 400 });
  }

  const { contentType, size, purpose } = parsed.data;
  const typeInfo = ALLOWED_UPLOAD_TYPES[contentType];
  if (!typeInfo) {
    return NextResponse.json(
      { error: "不支援的檔案格式(限 MP4、MOV、JPG、PNG、WebP)" },
      { status: 400 }
    );
  }
  const maxBytes = typeInfo.kind === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (size > maxBytes) {
    return NextResponse.json(
      {
        error:
          typeInfo.kind === "video"
            ? "影片不能超過 500MB"
            : "圖片不能超過 20MB",
      },
      { status: 400 }
    );
  }

  let key: string;
  if (purpose === "portfolio") {
    key = `portfolio/${user.id}/${crypto.randomUUID()}.${typeInfo.ext}`;
  } else {
    // 剪輯專案的拍攝素材:影片限定,且專案必須屬於本人
    if (typeInfo.kind !== "video") {
      return NextResponse.json(
        { error: "拍攝素材僅接受影片檔" },
        { status: 400 }
      );
    }
    const { projectId, slotId } = parsed.data;
    const { data: project } = await supabase
      .from("edit_projects")
      .select("id")
      .eq("id", projectId)
      .eq("creator_id", user.id)
      .maybeSingle();
    if (!project) {
      return NextResponse.json({ error: "找不到剪輯專案" }, { status: 404 });
    }
    key = `projects/${projectId}/slots/${slotId}.${typeInfo.ext}`;
  }

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: contentType,
    ContentLength: size,
  });
  const url = await getSignedUrl(r2Client(), command, { expiresIn: 600 });

  return NextResponse.json({
    url,
    key,
    publicPath: `/api/media/${key}`,
  });
}
