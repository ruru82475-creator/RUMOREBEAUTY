import "server-only";
import fs from "node:fs/promises";
import { parse as parseFont, type Font } from "opentype.js";
import {
  blurMask,
  commandsToEdges,
  compositeLayers,
  dilate,
  encodePng,
  rasterize,
  roundedRectSegments,
  subtractMask,
  type Layer,
  type RGBA,
} from "./raster";
import { CAPTION_STYLE_LABELS } from "./caption-styles";
import {
  subtitleStyleById,
  type SubtitleAnimation,
  type SubtitleStyle,
} from "@/lib/resources/subtitleStyles";

// 美術字幕 → 透明 PNG
// 全程純 JavaScript(字型輪廓 → 掃描線填色 → PNG),不依賴 ffmpeg 的 drawtext,
// 也不依賴 sharp 之類的原生套件,雲端環境不會因缺少元件而失敗
const CANVAS_WIDTH = 1080;
const BASE_FONT_SIZE = 74;
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

export type CaptionRender = {
  buffer: Buffer;
  width: number;
  height: number;
  animation: SubtitleAnimation;
};

/**
 * 產生字幕 PNG(透明背景)
 * styleId 決定整組風格;colorId 是「微調」區的配色覆蓋,設了就蓋掉風格的配色。
 */
export async function renderCaptionPng(params: {
  text: string;
  fontPath: string;
  styleId?: string | null;
  colorId?: string | null;
}): Promise<CaptionRender> {
  const { text, fontPath } = params;
  const style: SubtitleStyle = subtitleStyleById(params.styleId);

  // 微調區選了配色就覆蓋風格預設(漸層字被覆蓋時自動退回單色)
  const override = params.colorId ? CAPTION_STYLES[params.colorId] : undefined;
  const fill: RGBA = override ? override.fill : (style.fill as RGBA);
  const stroke: RGBA = override ? override.stroke : (style.stroke as RGBA);
  const gradient = override ? undefined : style.gradient;

  const fontSize = Math.round(BASE_FONT_SIZE * style.fontScale);
  const font = await loadFont(fontPath);
  const safeText = keepSupported(font, text.trim());
  if (!safeText) {
    throw new Error("字幕沒有可顯示的文字,請換一段文字再試");
  }

  const lines = wrapText(
    font,
    safeText,
    fontSize,
    CANVAS_WIDTH - SIDE_PADDING * 2
  );
  const lineHeight = fontSize * LINE_GAP;
  const blockHeight = lineHeight * lines.length;

  const edgePad =
    Math.max(style.strokeWidth, style.glow?.radius ?? 0, 4) + 8;
  const bgPadY = style.background?.paddingY ?? 0;
  const top = edgePad + bgPadY;
  const height = Math.ceil(top * 2 + blockHeight);

  // 收集所有行的字型輪廓線段
  const edges = lines.flatMap((line, i) => {
    const lineWidth = font.getAdvanceWidth(line, fontSize);
    const x = (CANVAS_WIDTH - lineWidth) / 2;
    const y = top + fontSize + i * lineHeight;
    return commandsToEdges(font.getPath(line, x, y, fontSize).commands);
  });

  const fillMask = rasterize(edges, CANVAS_WIDTH, height);
  const layers: Layer[] = [];

  // 1. 底條
  if (style.background) {
    const widest = Math.max(
      ...lines.map((line) => font.getAdvanceWidth(line, fontSize))
    );
    const barWidth = Math.min(
      widest + style.background.paddingX * 2,
      CANVAS_WIDTH
    );
    const barX = (CANVAS_WIDTH - barWidth) / 2;
    const barSegments = roundedRectSegments(
      barX,
      edgePad,
      barWidth,
      height - edgePad * 2,
      style.background.radius
    ).filter((s) => s.y0 !== s.y1);
    layers.push({
      mask: rasterize(barSegments, CANVAS_WIDTH, height),
      color: style.background.color as RGBA,
    });
  }

  // 2. 外光暈(霓虹)
  if (style.glow) {
    const spread = dilate(
      fillMask,
      CANVAS_WIDTH,
      height,
      Math.min(style.strokeWidth + 3, 10)
    );
    const glowMask = blurMask(spread, CANVAS_WIDTH, height, style.glow.radius);
    // 模糊會把峰值拉低,補一點增益才看得出發光
    for (let i = 0; i < glowMask.length; i++) {
      glowMask[i] = Math.min(glowMask[i] * 2.4, 1);
    }
    layers.push({ mask: glowMask, color: style.glow.color as RGBA });
  }

  // 3. 描邊(鏤空字要把字身挖掉,只留輪廓)
  if (style.strokeWidth > 0 && stroke[3] > 0) {
    const spread = dilate(fillMask, CANVAS_WIDTH, height, style.strokeWidth);
    layers.push({
      mask: style.hollow ? subtractMask(spread, fillMask) : spread,
      color: stroke,
    });
  }

  // 4. 字身填色
  if (!style.hollow && fill[3] > 0) {
    layers.push({
      mask: fillMask,
      color: fill,
      gradient: gradient
        ? {
            from: gradient.from as RGBA,
            to: gradient.to as RGBA,
            y0: top,
            y1: top + blockHeight,
          }
        : undefined,
    });
  }

  const rgba = compositeLayers(layers, CANVAS_WIDTH, height);

  return {
    buffer: encodePng(CANVAS_WIDTH, height, rgba),
    width: CANVAS_WIDTH,
    height,
    animation: style.animation,
  };
}
