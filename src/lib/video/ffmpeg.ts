import "server-only";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";

// ffmpeg / ffprobe 影片處理工具
// 輸入一律用 R2 預簽名 URL,不把整支影片下載進伺服器(省時間與記憶體)
if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobeStatic.path);

export type VideoInfo = {
  durationSec: number;
  width: number;
  height: number;
};

/** 取得影片時長與解析度 */
export function probeVideo(url: string): Promise<VideoInfo> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(url, (err, metadata) => {
      if (err) {
        reject(new Error("無法讀取影片資訊,檔案可能損壞或格式不支援"));
        return;
      }
      const stream = metadata.streams.find((s) => s.codec_type === "video");
      resolve({
        durationSec: Number(metadata.format.duration ?? 0),
        width: stream?.width ?? 0,
        height: stream?.height ?? 0,
      });
    });
  });
}

/**
 * 從影片抽取代表幀(10%、50%、90% 位置)
 * 輸出 base64 JPEG:品質約 80,寬度縮到 512px 節省 token
 */
export async function extractFrames(
  url: string,
  durationSec: number
): Promise<{ base64: string; mimeType: string }[]> {
  const positions = [0.1, 0.5, 0.9].map((p) => durationSec * p);
  const frames: { base64: string; mimeType: string }[] = [];

  for (const seconds of positions) {
    const tmpFile = path.join(os.tmpdir(), `gs-frame-${crypto.randomUUID()}.jpg`);
    try {
      await new Promise<void>((resolve, reject) => {
        ffmpeg(url)
          .inputOptions([`-ss ${seconds.toFixed(2)}`])
          .outputOptions(["-frames:v 1", "-vf scale=512:-2", "-q:v 4"])
          .on("end", () => resolve())
          .on("error", (err) =>
            reject(new Error(`抽取影格失敗(${err.message})`))
          )
          .save(tmpFile);
      });
      const buffer = await fs.readFile(tmpFile);
      frames.push({
        base64: buffer.toString("base64"),
        mimeType: "image/jpeg",
      });
    } finally {
      await fs.unlink(tmpFile).catch(() => {});
    }
  }

  return frames;
}
