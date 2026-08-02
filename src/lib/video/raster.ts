import zlib from "node:zlib";

// 純 JavaScript 的向量填色 + PNG 編碼
// 不依賴任何原生套件(sharp / canvas),任何執行環境都能用
export type RGBA = [number, number, number, number];

type Edge = { x0: number; y0: number; x1: number; y1: number };

/** 攤平後的線段(與 Edge 同形,但保留水平線,描邊時要用) */
export type Segment = Edge;

export type PathCommand = {
  type: string;
  x?: number;
  y?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
};

/**
 * 把輪廓(含貝茲曲線)攤平成線段,水平線也保留。
 * 掃描線填色用不到水平線,但描邊用得到。
 */
export function flattenCommands(
  commands: PathCommand[],
  subdivisions = 12
): Segment[] {
  const edges: Segment[] = [];
  let startX = 0;
  let startY = 0;
  let cx = 0;
  let cy = 0;

  const addLine = (x0: number, y0: number, x1: number, y1: number) => {
    if (x0 !== x1 || y0 !== y1) edges.push({ x0, y0, x1, y1 });
  };

  for (const cmd of commands) {
    switch (cmd.type) {
      case "M":
        startX = cx = cmd.x ?? 0;
        startY = cy = cmd.y ?? 0;
        break;
      case "L":
        addLine(cx, cy, cmd.x ?? 0, cmd.y ?? 0);
        cx = cmd.x ?? 0;
        cy = cmd.y ?? 0;
        break;
      case "Q": {
        const px = cx;
        const py = cy;
        for (let i = 1; i <= subdivisions; i++) {
          const t = i / subdivisions;
          const mt = 1 - t;
          const x = mt * mt * px + 2 * mt * t * (cmd.x1 ?? 0) + t * t * (cmd.x ?? 0);
          const y = mt * mt * py + 2 * mt * t * (cmd.y1 ?? 0) + t * t * (cmd.y ?? 0);
          addLine(cx, cy, x, y);
          cx = x;
          cy = y;
        }
        break;
      }
      case "C": {
        const px = cx;
        const py = cy;
        for (let i = 1; i <= subdivisions; i++) {
          const t = i / subdivisions;
          const mt = 1 - t;
          const x =
            mt * mt * mt * px +
            3 * mt * mt * t * (cmd.x1 ?? 0) +
            3 * mt * t * t * (cmd.x2 ?? 0) +
            t * t * t * (cmd.x ?? 0);
          const y =
            mt * mt * mt * py +
            3 * mt * mt * t * (cmd.y1 ?? 0) +
            3 * mt * t * t * (cmd.y2 ?? 0) +
            t * t * t * (cmd.y ?? 0);
          addLine(cx, cy, x, y);
          cx = x;
          cy = y;
        }
        break;
      }
      case "Z":
        addLine(cx, cy, startX, startY);
        cx = startX;
        cy = startY;
        break;
    }
  }

  return edges;
}

/** 把字型輪廓攤平成掃描線填色用的邊(水平線對填色無意義,濾掉) */
export function commandsToEdges(
  commands: PathCommand[],
  subdivisions = 12
): Edge[] {
  return flattenCommands(commands, subdivisions).filter((e) => e.y0 !== e.y1);
}

/** 掃描線填色(非零環繞規則),回傳 0~1 的覆蓋率 */
export function rasterize(
  edges: Edge[],
  width: number,
  height: number,
  samplesPerPixel = 4
): Float32Array {
  const coverage = new Float32Array(width * height);
  const crossings: { x: number; w: number }[] = [];

  for (let sy = 0; sy < height * samplesPerPixel; sy++) {
    const y = (sy + 0.5) / samplesPerPixel;
    crossings.length = 0;

    for (const e of edges) {
      const yMin = Math.min(e.y0, e.y1);
      const yMax = Math.max(e.y0, e.y1);
      if (y < yMin || y >= yMax) continue;
      const t = (y - e.y0) / (e.y1 - e.y0);
      crossings.push({ x: e.x0 + t * (e.x1 - e.x0), w: e.y1 > e.y0 ? 1 : -1 });
    }
    if (crossings.length < 2) continue;

    crossings.sort((a, b) => a.x - b.x);
    const rowOffset = Math.min(Math.floor(y), height - 1) * width;
    let winding = 0;

    for (let i = 0; i < crossings.length - 1; i++) {
      winding += crossings[i].w;
      if (winding === 0) continue;

      let xa = crossings[i].x;
      let xb = crossings[i + 1].x;
      if (xb <= 0 || xa >= width) continue;
      xa = Math.max(xa, 0);
      xb = Math.min(xb, width);
      if (xb <= xa) continue;

      const ia = Math.floor(xa);
      const ib = Math.floor(xb);
      const unit = 1 / samplesPerPixel;

      if (ia === ib) {
        coverage[rowOffset + ia] += (xb - xa) * unit;
      } else {
        coverage[rowOffset + ia] += (ia + 1 - xa) * unit;
        for (let x = ia + 1; x < ib; x++) coverage[rowOffset + x] += unit;
        if (ib < width) coverage[rowOffset + ib] += (xb - ib) * unit;
      }
    }
  }

  return coverage;
}

/** 圓形擴張(做文字外框用) */
export function dilate(
  mask: Float32Array,
  width: number,
  height: number,
  radius: number
): Float32Array {
  const offsets: number[] = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy <= radius * radius) offsets.push(dy * width + dx);
    }
  }

  const out = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      let max = 0;
      for (const off of offsets) {
        const j = i + off;
        if (j < 0 || j >= mask.length) continue;
        // 避免左右越界串行
        const jx = j % width;
        if (Math.abs(jx - x) > radius) continue;
        if (mask[j] > max) max = mask[j];
        if (max >= 1) break;
      }
      out[i] = max;
    }
  }
  return out;
}

/**
 * 沿著線段畫出指定粗細的線(抗鋸齒),回傳 0~1 覆蓋率。
 * 用於裝飾線條 — 開放路徑無法用填色規則處理,得直接描邊。
 */
export function strokeSegments(
  segments: Segment[],
  width: number,
  height: number,
  thickness: number
): Float32Array {
  const mask = new Float32Array(width * height);
  const half = thickness / 2;
  const reach = half + 1;

  for (const s of segments) {
    const minX = Math.max(0, Math.floor(Math.min(s.x0, s.x1) - reach));
    const maxX = Math.min(width - 1, Math.ceil(Math.max(s.x0, s.x1) + reach));
    const minY = Math.max(0, Math.floor(Math.min(s.y0, s.y1) - reach));
    const maxY = Math.min(height - 1, Math.ceil(Math.max(s.y0, s.y1) + reach));
    if (minX > maxX || minY > maxY) continue;

    const dx = s.x1 - s.x0;
    const dy = s.y1 - s.y0;
    const lenSq = dx * dx + dy * dy;

    for (let y = minY; y <= maxY; y++) {
      const row = y * width;
      for (let x = minX; x <= maxX; x++) {
        // 點到線段的最短距離
        let t = lenSq > 0 ? ((x + 0.5 - s.x0) * dx + (y + 0.5 - s.y0) * dy) / lenSq : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const px = s.x0 + t * dx - (x + 0.5);
        const py = s.y0 + t * dy - (y + 0.5);
        const dist = Math.sqrt(px * px + py * py);

        const coverage = half + 0.5 - dist;
        if (coverage <= 0) continue;
        const value = coverage > 1 ? 1 : coverage;
        if (value > mask[row + x]) mask[row + x] = value;
      }
    }
  }

  return mask;
}

/** 可分離的方框模糊(做柔光暈用,比反覆 dilate 快得多) */
export function blurMask(
  mask: Float32Array,
  width: number,
  height: number,
  radius: number
): Float32Array {
  if (radius < 1) return mask;
  const window = radius * 2 + 1;
  const pass1 = new Float32Array(width * height);
  const out = new Float32Array(width * height);

  for (let y = 0; y < height; y++) {
    const row = y * width;
    let sum = 0;
    for (let x = -radius; x <= radius; x++) {
      sum += mask[row + Math.min(Math.max(x, 0), width - 1)];
    }
    for (let x = 0; x < width; x++) {
      pass1[row + x] = sum / window;
      const outIdx = Math.min(Math.max(x - radius, 0), width - 1);
      const inIdx = Math.min(Math.max(x + radius + 1, 0), width - 1);
      sum += mask[row + inIdx] - mask[row + outIdx];
    }
  }

  for (let x = 0; x < width; x++) {
    let sum = 0;
    for (let y = -radius; y <= radius; y++) {
      sum += pass1[Math.min(Math.max(y, 0), height - 1) * width + x];
    }
    for (let y = 0; y < height; y++) {
      out[y * width + x] = sum / window;
      const outIdx = Math.min(Math.max(y - radius, 0), height - 1);
      const inIdx = Math.min(Math.max(y + radius + 1, 0), height - 1);
      sum += pass1[inIdx * width + x] - pass1[outIdx * width + x];
    }
  }

  return out;
}

/** a 扣掉 b(做鏤空字用:外擴後的形狀減掉字身 = 只剩描邊) */
export function subtractMask(
  a: Float32Array,
  b: Float32Array
): Float32Array {
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) {
    const value = a[i] - b[i];
    out[i] = value > 0 ? value : 0;
  }
  return out;
}

/** 圓角矩形的外框線段(radius 為 0 就是直角) */
export function roundedRectSegments(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  steps = 10
): Segment[] {
  const r = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
  const points: { x: number; y: number }[] = [];

  const arc = (
    cx: number,
    cy: number,
    startAngle: number,
    endAngle: number
  ) => {
    for (let i = 0; i <= steps; i++) {
      const angle = startAngle + ((endAngle - startAngle) * i) / steps;
      points.push({ x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r });
    }
  };

  if (r === 0) {
    points.push(
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height }
    );
  } else {
    points.push({ x: x + r, y });
    points.push({ x: x + width - r, y });
    arc(x + width - r, y + r, -Math.PI / 2, 0);
    points.push({ x: x + width, y: y + height - r });
    arc(x + width - r, y + height - r, 0, Math.PI / 2);
    points.push({ x: x + r, y: y + height });
    arc(x + r, y + height - r, Math.PI / 2, Math.PI);
    points.push({ x, y: y + r });
    arc(x + r, y + r, Math.PI, Math.PI * 1.5);
  }

  const segments: Segment[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    if (a.x !== b.x || a.y !== b.y) {
      segments.push({ x0: a.x, y0: a.y, x1: b.x, y1: b.y });
    }
  }
  return segments;
}

/** 一層要合成的內容:純色,或由上到下的漸層 */
export type Layer = {
  mask: Float32Array;
  color: RGBA;
  /** 設了就用漸層取代 color,範圍以外的列夾在兩端色 */
  gradient?: { from: RGBA; to: RGBA; y0: number; y1: number };
};

/** 由後往前逐層 src-over 合成為 RGBA */
export function compositeLayers(
  layers: Layer[],
  width: number,
  height: number
): Uint8Array {
  const rgba = new Uint8Array(width * height * 4);

  for (const layer of layers) {
    const { mask, color, gradient } = layer;
    for (let y = 0; y < height; y++) {
      let sr = color[0];
      let sg = color[1];
      let sb = color[2];
      if (gradient) {
        const span = gradient.y1 - gradient.y0;
        let t = span > 0 ? (y - gradient.y0) / span : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        sr = gradient.from[0] + (gradient.to[0] - gradient.from[0]) * t;
        sg = gradient.from[1] + (gradient.to[1] - gradient.from[1]) * t;
        sb = gradient.from[2] + (gradient.to[2] - gradient.from[2]) * t;
      }
      const rowOffset = y * width;

      for (let x = 0; x < width; x++) {
        const i = rowOffset + x;
        const coverage = mask[i] > 1 ? 1 : mask[i];
        if (coverage <= 0) continue;
        const srcA = coverage * (color[3] / 255);
        if (srcA <= 0) continue;

        const o = i * 4;
        const dstA = rgba[o + 3] / 255;
        const outA = srcA + dstA * (1 - srcA);
        if (outA <= 0) continue;

        rgba[o] = Math.round((sr * srcA + rgba[o] * dstA * (1 - srcA)) / outA);
        rgba[o + 1] = Math.round(
          (sg * srcA + rgba[o + 1] * dstA * (1 - srcA)) / outA
        );
        rgba[o + 2] = Math.round(
          (sb * srcA + rgba[o + 2] * dstA * (1 - srcA)) / outA
        );
        rgba[o + 3] = Math.round(outA * 255);
      }
    }
  }

  return rgba;
}

// ---- PNG 編碼 ----
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crc]);
}

export function encodePng(
  width: number,
  height: number,
  rgba: Uint8Array
): Buffer {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(
      raw,
      y * (stride + 1) + 1
    );
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw, { level: 6 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}
