import "server-only";
import fs from "node:fs/promises";
import { parse as parseFont, type Font } from "opentype.js";
import {
  commandsToEdges,
  composite,
  dilate,
  encodePng,
  rasterize,
  type RGBA,
} from "./raster";
import { CAPTION_STYLE_LABELS } from "./caption-styles";

// 美術字幕 → 透明 PNG
// 全程純 JavaScript(字型輪廓 → 掃描線填色 → PNG),不依賴 ffmpeg 的 drawtext,
// 也不依賴 sharp 之類的原生套件,雲端環境不會因缺少元件而失敗
const CANVAS_WIDTH = 1080;
const FONT_SIZE = 74;
const STROKE_RADIUS = 6;
const LINE_GAP = 1.32;
const SIDE_PADDING = 60;
const MAX_LINES = 3;

export type CaptionStyle = { fill: RGBA; stroke: RGBA };

// 配色定義集中在 caption-styles.ts(前後端共用)
export const CAPTION_STYLES: Record<string, CaptionStyle> = Object.fromEntries(
  CAPTION_STYLE_LABELS.map((s) => [
    s.id,
    { fill: s.fill as RGBA, stroke: s.stroke as RGBA },
  ])
);

// 依字型檔路徑快取(可選多種字體)
const fontCache = new Map<string, Font>();

async function loadFont(fontPath: string): Promise<Font> {
  const cached = fontCache.get(fontPath);
  if (cached) return cached;

  const buffer = await fs.readFile(fontPath);
  const font = parseFont(
    buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    ) as ArrayBuffer
  );
  fontCache.set(fontPath, font);
  return font;
}

/** 濾掉字型沒有的字元(否則會畫成空白方框) */
function keepSupported(font: Font, text: string): string {
  return Array.from(text)
    .filter((char) => {
      if (char === "\n" || char === " ") return true;
      return font.charToGlyphIndex(char) > 0;
    })
    .join("")
    .replace(/ {2,}/g, " ");
}

/** 依畫布寬度自動斷行(中文逐字量測) */
function wrapText(
  font: Font,
  text: string,
  fontSize: number,
  maxWidth: number
): string[] {
  const lines: string[] = [];
  let current = "";

  for (const char of Array.from(text)) {
    if (char === "\n") {
      lines.push(current);
      current = "";
      continue;
    }
    const candidate = current + char;
    if (font.getAdvanceWidth(candidate, fontSize) > maxWidth && current !== "") {
      lines.push(current);
      current = char;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, MAX_LINES);
}

/** 產生字幕 PNG(透明背景) */
export async function renderCaptionPng(params: {
  text: string;
  fontPath: string;
  style?: string;
}): Promise<{ buffer: Buffer; width: number; height: number }> {
  const { text, fontPath } = params;
  const style =
    CAPTION_STYLES[params.style ?? "classic"] ?? CAPTION_STYLES.classic;

  const font = await loadFont(fontPath);
  const safeText = keepSupported(font, text.trim());
  if (!safeText) {
    throw new Error("字幕沒有可顯示的文字,請換一段文字再試");
  }
  const lines = wrapText(
    font,
    safeText,
    FONT_SIZE,
    CANVAS_WIDTH - SIDE_PADDING * 2
  );

  const lineHeight = FONT_SIZE * LINE_GAP;
  const height = Math.ceil(lineHeight * lines.length + STROKE_RADIUS * 2 + 16);

  // 收集所有行的字型輪廓線段
  const edges = lines.flatMap((line, i) => {
    const lineWidth = font.getAdvanceWidth(line, FONT_SIZE);
    const x = (CANVAS_WIDTH - lineWidth) / 2;
    const y = STROKE_RADIUS + 8 + FONT_SIZE + i * lineHeight;
    return commandsToEdges(font.getPath(line, x, y, FONT_SIZE).commands);
  });

  const fillMask = rasterize(edges, CANVAS_WIDTH, height);
  const strokeMask = dilate(fillMask, CANVAS_WIDTH, height, STROKE_RADIUS);
  const rgba = composite(
    fillMask,
    strokeMask,
    style.fill,
    style.stroke,
    CANVAS_WIDTH,
    height
  );

  return {
    buffer: encodePng(CANVAS_WIDTH, height, rgba),
    width: CANVAS_WIDTH,
    height,
  };
}
