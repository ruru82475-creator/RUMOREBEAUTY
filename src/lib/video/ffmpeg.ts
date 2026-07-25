import "server-only";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import { beautyById, presetById } from "./presets";

// ffmpeg / ffprobe 影片處理工具
// 輸入一律用 R2 預簽名 URL,不把整支影片下載進伺服器(省時間與記憶體)
if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobeStatic.path);

const execFileAsync = promisify(execFile);

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

// 這個 ffmpeg 版本支援哪些濾鏡(不同平台的建置版本不同,例如雲端可能沒有 drawtext)
let filterCache: Set<string> | null = null;

export async function availableFilters(): Promise<Set<string>> {
  if (filterCache) return filterCache;
  try {
    const { stdout } = await execFileAsync(ffmpegPath as string, [
      "-hide_banner",
      "-filters",
    ]);
    const names = new Set<string>();
    for (const line of stdout.split("\n")) {
      // 格式: " ... name          V->V       description"
      const match = line.match(/^\s*[A-Z.]+\s+(\w+)\s+/);
      if (match) names.add(match[1]);
    }
    filterCache = names;
  } catch {
    filterCache = new Set();
  }
  return filterCache;
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

export type TransitionKind = "none" | "fade" | "zoom";

/**
 * 單支素材後製:縮時 + 直式構圖 + 風格濾鏡 + 轉場 + 美術字幕 + 背景音樂
 * 字幕以 PNG 疊圖方式合成(不依賴 ffmpeg 的 drawtext)
 * 回傳輸出檔的暫存路徑(呼叫端負責讀取後刪除)
 */
export async function renderEdit(params: {
  videoUrl: string;
  sourceDurationSec: number;
  speed: number; // 1 / 2 / 4 / 8
  effect?: string;
  beauty?: string;
  transition?: TransitionKind;
  captionPngPath?: string | null;
  musicUrl?: string | null;
}): Promise<string> {
  const {
    videoUrl,
    sourceDurationSec,
    speed,
    effect = "none",
    beauty = "off",
    transition = "fade",
    captionPngPath,
    musicUrl,
  } = params;

  const outPath = path.join(os.tmpdir(), `gs-edit-${crypto.randomUUID()}.mp4`);
  const outDur = Math.min(sourceDurationSec / speed, 120);
  const filters = await availableFilters();
  const has = (name: string) => filters.size === 0 || filters.has(name);

  // 主要視訊處理鏈
  const chain: string[] = [
    `setpts=PTS/${speed}`,
    "scale=1080:1920:force_original_aspect_ratio=increase",
    "crop=1080:1920",
    "fps=30",
  ];

  // 美顏磨皮 → 風格濾鏡(只加入這個 ffmpeg 版本支援的濾鏡)
  const addFilters = (list: string[]) => {
    for (const filter of list) {
      const name = filter.split("=")[0];
      if (has(name)) chain.push(filter);
    }
  };
  addFilters(beautyById(beauty).chain);
  addFilters(presetById(effect).chain);

  // 轉場:淡入淡出 / 緩慢推進
  if (transition === "zoom" && has("zoompan")) {
    const totalFrames = Math.max(Math.round(outDur * 30), 1);
    chain.push(
      `zoompan=z='min(zoom+0.0006,1.12)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30`,
      `trim=end_frame=${totalFrames}`
    );
  }
  if ((transition === "fade" || transition === "zoom") && has("fade")) {
    const fadeOutStart = Math.max(outDur - 0.7, 0);
    chain.push(
      "fade=t=in:st=0:d=0.6",
      `fade=t=out:st=${fadeOutStart.toFixed(2)}:d=0.7`
    );
  }

  // 組 filter_complex:視訊鏈 →(可選)疊上字幕 PNG
  const inputs: string[] = [videoUrl];
  if (musicUrl) inputs.push(musicUrl);
  const captionIndex = captionPngPath ? inputs.length : -1;
  if (captionPngPath) inputs.push(captionPngPath);

  const complex: string[] = [`[0:v]${chain.join(",")}[vmain]`];
  let videoLabel = "[vmain]";
  if (captionIndex >= 0 && has("overlay")) {
    complex.push(
      `[vmain][${captionIndex}:v]overlay=(W-w)/2:H-h-200:format=auto[vout]`
    );
    videoLabel = "[vout]";
  }

  await new Promise<void>((resolve, reject) => {
    const command = ffmpeg();
    inputs.forEach((input, i) => {
      command.input(input);
      // 字幕 PNG 是靜態圖,需標成無限循環才能疊滿整支影片
      if (i === captionIndex) command.inputOptions(["-loop", "1"]);
    });

    const output = [
      "-filter_complex",
      complex.join(";"),
      "-map",
      videoLabel,
      "-t",
      outDur.toFixed(2),
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
}
