import "server-only";
import fs from "node:fs/promises";
import { parse as parseFont, type Font } from "opentype.js";
import sharp from "sharp";

// 美術字幕 → 透明 PNG
// 不使用 ffmpeg 的 drawtext(雲端 ffmpeg 版本不一定內建文字濾鏡),
// 改以字型輪廓轉 SVG path 再點陣化,任何 ffmpeg 版本都能用 overlay 疊上去
const CANVAS_WIDTH = 1080;
const FONT_SIZE = 72;
const STROKE_WIDTH = 10;
const LINE_GAP = 1.35;
const SIDE_PADDING = 60;

export type CaptionStyle = {
  fill: string;
  stroke: string;
};

export const CAPTION_STYLES: Record<string, CaptionStyle> = {
  classic: { fill: "#ffffff", stroke: "rgba(0,0,0,0.75)" }, // 白字黑邊
  rose: { fill: "#ffe9ee", stroke: "rgba(120,40,60,0.8)" }, // 玫瑰金
  gold: { fill: "#fff3d0", stroke: "rgba(90,60,10,0.8)" }, // 香檳金
  ink: { fill: "#1b1218", stroke: "rgba(255,255,255,0.85)" }, // 黑字白邊
};

let cachedFont: Font | null = null;

async function loadFont(fontPath: string): Promise<Font> {
  if (!cachedFont) {
    const buffer = await fs.readFile(fontPath);
    cachedFont = parseFont(
      buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
      ) as ArrayBuffer
    );
  }
  return cachedFont;
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
    if (
      font.getAdvanceWidth(candidate, fontSize) > maxWidth &&
      current !== ""
    ) {
      lines.push(current);
      current = char;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3); // 最多三行
}

/**
 * 產生字幕 PNG(透明背景),回傳 PNG buffer 與尺寸
 */
export async function renderCaptionPng(params: {
  text: string;
  fontPath: string;
  style?: keyof typeof CAPTION_STYLES;
}): Promise<{ buffer: Buffer; width: number; height: number }> {
  const { text, fontPath } = params;
  const style = CAPTION_STYLES[params.style ?? "classic"] ?? CAPTION_STYLES.classic;

  const font = await loadFont(fontPath);
  const maxTextWidth = CANVAS_WIDTH - SIDE_PADDING * 2;
  const lines = wrapText(font, text.trim(), FONT_SIZE, maxTextWidth);

  const lineHeight = FONT_SIZE * LINE_GAP;
  const height = Math.ceil(lineHeight * lines.length + STROKE_WIDTH * 2);

  const paths = lines
    .map((line, i) => {
      const lineWidth = font.getAdvanceWidth(line, FONT_SIZE);
      const x = (CANVAS_WIDTH - lineWidth) / 2;
      const y = STROKE_WIDTH + FONT_SIZE + i * lineHeight;
      return font.getPath(line, x, y, FONT_SIZE).toPathData(2);
    })
    .filter(Boolean);

  // 先描邊再填色(librsvg 不支援 paint-order,改畫兩層)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_WIDTH}" height="${height}">
${paths
  .map(
    (d) =>
      `<path d="${d}" fill="none" stroke="${style.stroke}" stroke-width="${STROKE_WIDTH}" stroke-linejoin="round" stroke-linecap="round"/>`
  )
  .join("\n")}
${paths.map((d) => `<path d="${d}" fill="${style.fill}"/>`).join("\n")}
</svg>`;

  const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
  return { buffer, width: CANVAS_WIDTH, height };
}
