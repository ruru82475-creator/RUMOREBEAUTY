import "server-only";
import {
  blurMask,
  compositeLayers,
  encodePng,
  flattenCommands,
  roundedRectSegments,
  strokeSegments,
  type Layer,
  type PathCommand,
  type Segment,
} from "./raster";
import {
  decorationById,
  type DecorationPlacement,
} from "@/lib/resources/decorations";

// 裝飾圖層 → 透明 PNG
// 跟字幕走同一條純 JS 管線(向量 → 掃描線 → PNG),不依賴 sharp / canvas,
// 產生的 PNG 再交給 ffmpeg overlay 疊上影片。
const CANVAS_W = 1080;
const CANVAS_H = 1920;

export type DecorationOverlay = {
  buffer: Buffer;
  width: number;
  height: number;
  /** 疊圖位置(相對 1080x1920 畫布左上角) */
  x: number;
  y: number;
};

/** 極簡 SVG path 解析(支援 M/L/H/V/C/Q/Z,含相對座標) */
export function parsePathData(d: string): PathCommand[] {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
  const commands: PathCommand[] = [];
  let i = 0;
  let cx = 0;
  let cy = 0;
  let startX = 0;
  let startY = 0;
  let op = "";

  const num = () => Number(tokens[i++]);

  while (i < tokens.length) {
    const cursorBefore = i;
    if (/^[a-zA-Z]$/.test(tokens[i])) op = tokens[i++];
    const relative = op === op.toLowerCase();
    const baseX = relative ? cx : 0;
    const baseY = relative ? cy : 0;

    switch (op.toUpperCase()) {
      case "M": {
        const x = num() + baseX;
        const y = num() + baseY;
        commands.push({ type: "M", x, y });
        cx = startX = x;
        cy = startY = y;
        // SVG 規範:M 之後接續的座標視為 lineto
        op = relative ? "l" : "L";
        break;
      }
      case "L": {
        const x = num() + baseX;
        const y = num() + baseY;
        commands.push({ type: "L", x, y });
        cx = x;
        cy = y;
        break;
      }
      case "H": {
        const x = num() + baseX;
        commands.push({ type: "L", x, y: cy });
        cx = x;
        break;
      }
      case "V": {
        const y = num() + baseY;
        commands.push({ type: "L", x: cx, y });
        cy = y;
        break;
      }
      case "C": {
        const x1 = num() + baseX;
        const y1 = num() + baseY;
        const x2 = num() + baseX;
        const y2 = num() + baseY;
        const x = num() + baseX;
        const y = num() + baseY;
        commands.push({ type: "C", x1, y1, x2, y2, x, y });
        cx = x;
        cy = y;
        break;
      }
      case "Q": {
        const x1 = num() + baseX;
        const y1 = num() + baseY;
        const x = num() + baseX;
        const y = num() + baseY;
        commands.push({ type: "Q", x1, y1, x, y });
        cx = x;
        cy = y;
        break;
      }
      case "Z": {
        commands.push({ type: "Z" });
        cx = startX;
        cy = startY;
        break;
      }
      default:
        i++;
    }

    // 遇到不合法的資料時避免原地打轉
    if (i === cursorBefore) break;
  }

  return commands;
}

/** 把 0~100 的局部座標搬到 1080x1920 畫布上(可左右/上下翻轉) */
function transformCommands(
  commands: PathCommand[],
  placement: DecorationPlacement
): PathCommand[] {
  const scale = placement.size / 100;
  const mapX = (value: number) =>
    placement.x + (placement.flipX ? 100 - value : value) * scale;
  const mapY = (value: number) =>
    placement.y + (placement.flipY ? 100 - value : value) * scale;

  return commands.map((cmd) => {
    const next: PathCommand = { type: cmd.type };
    if (cmd.x !== undefined) next.x = mapX(cmd.x);
    if (cmd.y !== undefined) next.y = mapY(cmd.y);
    if (cmd.x1 !== undefined) next.x1 = mapX(cmd.x1);
    if (cmd.y1 !== undefined) next.y1 = mapY(cmd.y1);
    if (cmd.x2 !== undefined) next.x2 = mapX(cmd.x2);
    if (cmd.y2 !== undefined) next.y2 = mapY(cmd.y2);
    return next;
  });
}

/** 裝飾若是走 ffmpeg 原生濾鏡(例如暗角),回傳要串進主濾鏡鏈的指令 */
export function decorationFfmpegChain(id: string | null | undefined): string[] {
  const spec = decorationById(id);
  if (!spec.available) return [];
  return spec.render.kind === "ffmpeg" ? spec.render.chain : [];
}

/** 產生裝飾的透明 PNG;走 ffmpeg 濾鏡或尚未上線的裝飾回傳 null */
export function renderDecorationPng(
  id: string | null | undefined
): DecorationOverlay | null {
  const spec = decorationById(id);
  if (!spec.available) return null;
  const render = spec.render;

  if (render.kind === "gradient") {
    const height = Math.min(render.height, CANVAS_H);
    const mask = new Float32Array(CANVAS_W * height);
    for (let y = 0; y < height; y++) {
      const ratio = height > 1 ? y / (height - 1) : 1;
      // 二次曲線讓遠端那側淡出得更自然,不會出現硬邊
      const value = render.anchor === "bottom" ? ratio * ratio : (1 - ratio) ** 2;
      mask.fill(value, y * CANVAS_W, (y + 1) * CANVAS_W);
    }
    const rgba = compositeLayers(
      [{ mask, color: render.color }],
      CANVAS_W,
      height
    );
    return {
      buffer: encodePng(CANVAS_W, height, rgba),
      width: CANVAS_W,
      height,
      x: 0,
      y: render.anchor === "bottom" ? CANVAS_H - height : 0,
    };
  }

  if (render.kind === "frame") {
    const layers: Layer[] = [];
    const outer = roundedRectSegments(
      render.inset,
      render.inset,
      CANVAS_W - render.inset * 2,
      CANVAS_H - render.inset * 2,
      render.radius
    );
    layers.push({
      mask: strokeSegments(outer, CANVAS_W, CANVAS_H, render.strokeWidth),
      color: render.color,
    });

    if (render.inner) {
      const inset = render.inset + render.inner.gap;
      const inner = roundedRectSegments(
        inset,
        inset,
        CANVAS_W - inset * 2,
        CANVAS_H - inset * 2,
        Math.max(render.radius - render.inner.gap, 0)
      );
      layers.push({
        mask: strokeSegments(
          inner,
          CANVAS_W,
          CANVAS_H,
          render.inner.strokeWidth
        ),
        color: render.color,
      });
    }

    const rgba = compositeLayers(layers, CANVAS_W, CANVAS_H);
    return {
      buffer: encodePng(CANVAS_W, CANVAS_H, rgba),
      width: CANVAS_W,
      height: CANVAS_H,
      x: 0,
      y: 0,
    };
  }

  if (render.kind === "path") {
    const segments: Segment[] = [];
    for (const placement of render.placements) {
      for (const d of render.paths) {
        const commands = transformCommands(parsePathData(d), placement);
        segments.push(...flattenCommands(commands, 16));
      }
    }
    if (segments.length === 0) return null;

    const line = strokeSegments(
      segments,
      CANVAS_W,
      CANVAS_H,
      render.strokeWidth
    );
    // 線條下方鋪一層很淡的柔光,金線在亮背景上才不會糊掉
    const halo = blurMask(line, CANVAS_W, CANVAS_H, 5);
    const rgba = compositeLayers(
      [
        { mask: halo, color: [0, 0, 0, 90] },
        { mask: line, color: render.color },
      ],
      CANVAS_W,
      CANVAS_H
    );
    return {
      buffer: encodePng(CANVAS_W, CANVAS_H, rgba),
      width: CANVAS_W,
      height: CANVAS_H,
      x: 0,
      y: 0,
    };
  }

  return null;
}
