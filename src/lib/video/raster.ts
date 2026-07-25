import zlib from "node:zlib";

// 純 JavaScript 的向量填色 + PNG 編碼
// 不依賴任何原生套件(sharp / canvas),任何執行環境都能用
export type RGBA = [number, number, number, number];

type Edge = { x0: number; y0: number; x1: number; y1: number };

type PathCommand = {
  type: string;
  x?: number;
  y?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
};

/** 把字型輪廓(含貝茲曲線)攤平成線段 */
export function commandsToEdges(
  commands: PathCommand[],
  subdivisions = 12
): Edge[] {
  const edges: Edge[] = [];
  let startX = 0;
  let startY = 0;
  let cx = 0;
  let cy = 0;

  const addLine = (x0: number, y0: number, x1: number, y1: number) => {
    if (y0 !== y1) edges.push({ x0, y0, x1, y1 });
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

/** 外框色 + 填色兩層合成為 RGBA */
export function composite(
  fillMask: Float32Array,
  strokeMask: Float32Array,
  fill: RGBA,
  stroke: RGBA,
  width: number,
  height: number
): Uint8Array {
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const af = Math.min(fillMask[i], 1) * (fill[3] / 255);
    const as = Math.min(strokeMask[i], 1) * (stroke[3] / 255);
    const outA = af + as * (1 - af);
    const o = i * 4;
    if (outA <= 0) continue;
    for (let c = 0; c < 3; c++) {
      rgba[o + c] = Math.round(
        (fill[c] * af + stroke[c] * as * (1 - af)) / outA
      );
    }
    rgba[o + 3] = Math.round(outA * 255);
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
