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
 * 從影片抽取代表幀(預設 10%、50%、90% 位置)
 * 輸出 base64 JPEG:品質約 80,寬度縮到 512px 節省 token
 */
export async function extractFrames(
  url: string,
  durationSec: number,
  positionRatios: number[] = [0.1, 0.5, 0.9]
): Promise<{ base64: string; mimeType: string }[]> {
  const positions = positionRatios.map((p) => durationSec * p);
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

// ffmpeg 濾鏡參數用的路徑:統一斜線 + 冒號跳脫(Windows 磁碟機代號)
function escFilterPath(p: string): string {
  return p.split(path.sep).join("/").replace(/:/g, "\\:");
}

/**
 * 單支素材後製:縮時(倍速)+ 直式構圖 + 美術字幕 + 背景音樂
 * 回傳輸出檔的暫存路徑(呼叫端負責讀取後刪除)
 */
export async function renderEdit(params: {
  videoUrl: string;
  sourceDurationSec: number;
  speed: number; // 1 / 2 / 4 / 8
  caption?: string | null;
  fontPath?: string | null;
  musicUrl?: string | null;
}): Promise<string> {
  const { videoUrl, sourceDurationSec, speed, caption, fontPath, musicUrl } =
    params;
  const tmpDir = os.tmpdir();
  const id = crypto.randomUUID();
  const outPath = path.join(tmpDir, `gs-edit-${id}.mp4`);
  const textFile = path.join(tmpDir, `gs-caption-${id}.txt`);

  // 成品長度:縮時後的長度,安全上限 120 秒
  const outDur = Math.min(sourceDurationSec / speed, 120);

  const filters = [
    `setpts=PTS/${speed}`,
    "scale=1080:1920:force_original_aspect_ratio=increase",
    "crop=1080:1920",
    "fps=30",
  ];

  let hasCaption = false;
  if (caption && caption.trim() && fontPath) {
    await fs.writeFile(textFile, caption.trim(), "utf8");
    hasCaption = true;
    filters.push(
      `drawtext=fontfile='${escFilterPath(fontPath)}':textfile='${escFilterPath(textFile)}':fontcolor=white:fontsize=68:borderw=4:bordercolor=black@0.55:x=(w-text_w)/2:y=h-th-180`
    );
  }

  try {
    await new Promise<void>((resolve, reject) => {
      const command = ffmpeg(videoUrl);
      if (musicUrl) command.input(musicUrl);

      const output = [
        "-t",
        outDur.toFixed(2),
        "-vf",
        filters.join(","),
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "26",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
      ];

      if (musicUrl) {
        // 以背景音樂取代原始聲音(縮時後原聲會變調),結尾淡出
        const fadeStart = Math.max(outDur - 1.5, 0);
        output.push(
          "-map",
          "0:v",
          "-map",
          "1:a",
          "-af",
          `afade=t=out:st=${fadeStart.toFixed(2)}:d=1.5`,
          "-c:a",
          "aac",
          "-b:a",
          "128k",
          "-shortest"
        );
      } else {
        output.push("-an");
      }

      command
        .outputOptions(output)
        .on("end", () => resolve())
        .on("error", (err) => reject(new Error(`後製失敗(${err.message})`)))
        .save(outPath);
    });

    return outPath;
  } finally {
    if (hasCaption) await fs.unlink(textFile).catch(() => {});
  }
}

/**
 * 簡易後製:各片段裁到槽位秒數、統一 1080x1920 直式 30fps,再無縫串接
 * 回傳輸出檔的暫存路徑(呼叫端負責讀取後刪除)
 * (之後接 Remotion 時只需替換這層,前端流程不動)
 */
export async function renderSlots(
  items: { url: string; durationSec: number }[]
): Promise<string> {
  const tmpDir = os.tmpdir();
  const id = crypto.randomUUID();
  const clipPaths: string[] = [];
  const listPath = path.join(tmpDir, `gs-list-${id}.txt`);
  const outPath = path.join(tmpDir, `gs-out-${id}.mp4`);

  try {
    for (const [i, item] of items.entries()) {
      const clipPath = path.join(tmpDir, `gs-clip-${id}-${i}.mp4`);
      await new Promise<void>((resolve, reject) => {
        ffmpeg(item.url)
          .outputOptions([
            "-t",
            item.durationSec.toFixed(2),
            "-vf",
            "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "26",
            "-pix_fmt",
            "yuv420p",
            "-an",
            "-movflags",
            "+faststart",
          ])
          .on("end", () => resolve())
          .on("error", (err) =>
            reject(new Error(`片段處理失敗(${err.message})`))
          )
          .save(clipPath);
      });
      clipPaths.push(clipPath);
    }

    await fs.writeFile(
      listPath,
      clipPaths
        .map((p) => `file '${p.split(path.sep).join("/")}'`)
        .join("\n"),
      "utf8"
    );

    await new Promise<void>((resolve, reject) => {
      ffmpeg(listPath)
        .inputOptions(["-f", "concat", "-safe", "0"])
        .outputOptions(["-c", "copy", "-movflags", "+faststart"])
        .on("end", () => resolve())
        .on("error", (err) => reject(new Error(`影片串接失敗(${err.message})`)))
        .save(outPath);
    });

    return outPath;
  } finally {
    await Promise.all(
      [...clipPaths, listPath].map((p) => fs.unlink(p).catch(() => {}))
    );
  }
}
