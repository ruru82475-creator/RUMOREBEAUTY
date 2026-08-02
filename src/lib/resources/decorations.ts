// 裝飾動效資源庫(前後端共用,不可引用 Node 專用模組)
//
// available: true  的裝飾會由 src/lib/video/decoration.ts 產生透明 PNG,
//            再交給 ffmpeg 疊到影片上 — 跟字幕同一條純 JS 管線,零原生相依。
// available: false 的是需要逐格運算的粒子動畫,目前的 ffmpeg 管線做不到,
//            定義先留著,UI 上顯示「即將推出」,之後接逐格渲染不用重寫。
import type { MusicMood } from "./music";

export type DecorationCategory = "frame" | "overlay" | "light" | "corner";

export const DECORATION_CATEGORIES: {
  id: DecorationCategory;
  label: string;
}[] = [
  { id: "frame", label: "邊框" },
  { id: "overlay", label: "覆蓋" },
  { id: "corner", label: "角落點綴" },
  { id: "light", label: "光效" },
];

/** [r, g, b, a] — a 為 0~255 */
export type DecorationColor = [number, number, number, number];

/**
 * 把 0~100 的局部座標系擺到 1080x1920 畫布上。
 * x / y 是左上角座標,size 是縮放後的邊長。
 */
export type DecorationPlacement = {
  x: number;
  y: number;
  size: number;
  flipX?: boolean;
  flipY?: boolean;
};

export type DecorationRender =
  /** 直接交給 ffmpeg 的原生濾鏡(不需要產生 PNG) */
  | { kind: "ffmpeg"; chain: string[] }
  /** 圓角矩形外框,可選內側細線 */
  | {
      kind: "frame";
      inset: number;
      strokeWidth: number;
      radius: number;
      color: DecorationColor;
      inner?: { gap: number; strokeWidth: number };
    }
  /** 單邊漸層覆蓋(放字幕用) */
  | {
      kind: "gradient";
      height: number;
      anchor: "top" | "bottom";
      color: DecorationColor;
    }
  /** SVG 路徑描邊(座標系 0~100,由 placements 決定擺放位置) */
  | {
      kind: "path";
      paths: string[];
      color: DecorationColor;
      strokeWidth: number;
      placements: DecorationPlacement[];
    }
  /** 尚未實作(需要逐格動畫) */
  | { kind: "pending" };

export type DecorationSpec = {
  id: string;
  label: string;
  description: string;
  category: DecorationCategory;
  moods: MusicMood[];
  available: boolean;
  /** 未上線的原因,UI 直接顯示給使用者看 */
  unavailableReason?: string;
  /** 縮圖預覽用的 CSS 宣告,套在蓋滿縮圖的絕對定位 div 上 */
  previewCss?: string;
  render: DecorationRender;
};

const GOLD: DecorationColor = [197, 165, 90, 235];
const WHITE: DecorationColor = [255, 255, 255, 228];

export const DECORATIONS: DecorationSpec[] = [
  {
    id: "none",
    label: "不加裝飾",
    description: "保持畫面乾淨",
    category: "overlay",
    moods: ["elegant", "chill", "upbeat", "energetic", "cinematic"],
    available: true,
    render: { kind: "ffmpeg", chain: [] },
  },
  {
    id: "frame-elegant",
    label: "優雅邊框",
    description: "金色雙線圓角框 — 證照、形象照、質感作品",
    category: "frame",
    moods: ["elegant", "cinematic"],
    available: true,
    previewCss:
      "inset:7%;border:2px solid #C5A55A;border-radius:8px;box-shadow:inset 0 0 0 1px rgba(197,165,90,.5)",
    render: {
      kind: "frame",
      inset: 46,
      strokeWidth: 3,
      radius: 30,
      color: GOLD,
      inner: { gap: 14, strokeWidth: 1 },
    },
  },
  {
    id: "frame-minimal",
    label: "極簡邊框",
    description: "單色細線直角框 — 什麼題材都不會出錯",
    category: "frame",
    moods: ["chill", "upbeat", "elegant"],
    available: true,
    previewCss: "inset:6%;border:1px solid rgba(255,255,255,.78)",
    render: {
      kind: "frame",
      inset: 38,
      strokeWidth: 2,
      radius: 0,
      color: WHITE,
    },
  },
  {
    id: "gradient-overlay",
    label: "漸層覆蓋",
    description: "底部漸黑 — 字幕壓在上面看得最清楚",
    category: "overlay",
    moods: ["elegant", "chill", "upbeat", "energetic", "cinematic"],
    available: true,
    previewCss:
      "background:linear-gradient(to top,rgba(0,0,0,.85),transparent 62%)",
    render: {
      kind: "gradient",
      height: 760,
      anchor: "bottom",
      color: [0, 0, 0, 205],
    },
  },
  {
    id: "vignette",
    label: "暗角",
    description: "四角壓暗把視線收到中央 — 特寫很有效",
    category: "overlay",
    moods: ["cinematic", "elegant"],
    available: true,
    previewCss: "box-shadow:inset 0 0 40px 14px rgba(0,0,0,.6)",
    render: { kind: "ffmpeg", chain: ["vignette=PI/4"] },
  },
  {
    id: "floral",
    label: "花卉角落",
    description: "簡化花草紋飾點在對角 — 美容題材的安全牌",
    category: "corner",
    moods: ["elegant", "chill"],
    available: true,
    render: {
      kind: "path",
      color: GOLD,
      strokeWidth: 5,
      paths: [
        "M 6 96 C 22 74 34 58 54 48",
        "M 54 48 C 45 31 51 15 66 11 C 77 22 74 37 61 46",
        "M 54 48 C 65 35 81 33 92 42 C 85 57 70 60 59 51",
        "M 30 70 C 25 57 32 46 45 44 C 49 55 44 66 33 71",
        "M 16 84 C 12 76 15 68 23 66",
      ],
      placements: [
        { x: 44, y: 92, size: 280 },
        { x: 756, y: 1548, size: 280, flipX: true, flipY: true },
      ],
    },
  },
  {
    id: "gold-swirls",
    label: "金色曲線",
    description: "上下對稱的金色捲曲飾帶 — 證照與品牌形象的經典款",
    category: "frame",
    moods: ["elegant", "cinematic"],
    available: true,
    render: {
      kind: "path",
      color: GOLD,
      strokeWidth: 4,
      paths: [
        "M 3 52 C 18 26 34 26 50 50 C 66 74 82 74 97 48",
        "M 14 50 C 25 36 37 37 50 50",
        "M 50 50 C 63 63 75 64 86 50",
        // 兩端的小捲鬚(左右對稱)
        "M 3 52 C 0 59 5 64 10 59 C 13 55 9 50 5 52",
        "M 97 48 C 100 41 95 36 90 41 C 87 45 91 50 95 48",
      ],
      // 線條只佔 0~100 座標框的中間帶(y 約 26~74),擺放位置已算進這件事
      placements: [
        { x: 160, y: 30, size: 760 },
        { x: 160, y: 1130, size: 760, flipY: true },
      ],
    },
  },
  {
    id: "geometric",
    label: "幾何線條",
    description: "三角、圓、線段的組合 — 3D 列印與器械題材的科技感",
    category: "frame",
    moods: ["upbeat", "energetic"],
    available: true,
    render: {
      kind: "path",
      color: WHITE,
      strokeWidth: 4,
      paths: [
        "M 8 12 L 92 12",
        "M 50 24 L 70 60 L 30 60 Z",
        "M 50 34 C 59 34 66 41 66 50 C 66 59 59 66 50 66 C 41 66 34 59 34 50 C 34 41 41 34 50 34 Z",
        "M 20 76 L 34 76",
        "M 66 76 L 80 76",
        "M 8 88 L 92 88",
      ],
      placements: [
        { x: 310, y: 200, size: 460 },
        { x: 310, y: 1260, size: 460, flipY: true },
      ],
    },
  },
  {
    id: "sparkle-particles",
    label: "星光粒子",
    description: "細小光點飄動閃爍",
    category: "light",
    moods: ["elegant", "upbeat"],
    available: false,
    unavailableReason: "需要逐格動畫,目前的影片管線做不到",
    render: { kind: "pending" },
  },
  {
    id: "light-leak",
    label: "光暈洩漏",
    description: "半透明漸層色塊從邊緣滑入",
    category: "light",
    moods: ["cinematic", "energetic"],
    available: false,
    unavailableReason: "需要逐格動畫,目前的影片管線做不到",
    render: { kind: "pending" },
  },
  {
    id: "bokeh",
    label: "散景光點",
    description: "大顆低透明度光斑緩慢飄移",
    category: "light",
    moods: ["chill", "elegant"],
    available: false,
    unavailableReason: "需要逐格動畫,目前的影片管線做不到",
    render: { kind: "pending" },
  },
];

export function decorationById(
  id: string | null | undefined
): DecorationSpec {
  if (!id) return DECORATIONS[0];
  return DECORATIONS.find((d) => d.id === id) ?? DECORATIONS[0];
}

/** 取某個氛圍適合的裝飾(「不加裝飾」永遠排最前面) */
export function decorationsByMood(mood: string): DecorationSpec[] {
  const matched = DECORATIONS.filter(
    (d) => d.id !== "none" && d.available && d.moods.includes(mood as MusicMood)
  );
  return [DECORATIONS[0], ...matched];
}

export function decorationsByCategory(category: string): DecorationSpec[] {
  return DECORATIONS.filter((d) => d.category === category);
}
