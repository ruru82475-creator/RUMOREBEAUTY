import "server-only";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Cloudflare R2(S3 相容 API)連線
// 金鑰僅存在環境變數;此模組不可被 Client Component 引用("server-only" 把關)
export const R2_BUCKET = process.env.R2_BUCKET_NAME!;

let client: S3Client | null = null;

export function r2Client() {
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return client;
}

/** 產生 R2 預簽名 GET URL(伺服器端讀取檔案用) */
export function presignGet(key: string, expiresInSec = 600) {
  return getSignedUrl(
    r2Client(),
    new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }),
    { expiresIn: expiresInSec }
  );
}

// 允許的上傳格式與對應副檔名
export const ALLOWED_UPLOAD_TYPES: Record<
  string,
  { ext: string; kind: "video" | "image" }
> = {
  "video/mp4": { ext: "mp4", kind: "video" },
  "video/quicktime": { ext: "mov", kind: "video" },
  "image/jpeg": { ext: "jpg", kind: "image" },
  "image/png": { ext: "png", kind: "image" },
  "image/webp": { ext: "webp", kind: "image" },
};

// 背景音樂允許的格式
export const ALLOWED_AUDIO_TYPES: Record<string, { ext: string }> = {
  "audio/mpeg": { ext: "mp3" },
  "audio/mp4": { ext: "m4a" },
  "audio/x-m4a": { ext: "m4a" },
  "audio/wav": { ext: "wav" },
};

export const MAX_VIDEO_BYTES = 500 * 1024 * 1024; // 500MB
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024; // 20MB
export const MAX_AUDIO_BYTES = 20 * 1024 * 1024; // 20MB
