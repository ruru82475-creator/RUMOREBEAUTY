// 字幕風格資源庫(前後端共用,不可引用 Node 專用模組)
//
// 一組風格 = 字體 + 字級 + 填色 + 描邊 + 底條 + 進場方式,一次配好。
// 使用者仍可在「微調」區單獨換字體或配色 — 換了就以微調的值為準。
//
// 伺服器端由 src/lib/video/caption.ts 依這裡的參數把字畫成透明 PNG,
// 再交給 ffmpeg 疊圖(不依賴 drawtext,雲端不會因缺元件而失敗)。
import type { MusicMood } from "./music";

export type SubtitleCategory =
  | "classic"
  | "elegant"
  | "impact"
  | "minimal"
  | "fx";

export const SUBTITLE_CATEGORIES: {
  id: SubtitleCategory;
  label: string;
}[] = [
  { id: "classic", label: "經典" },
  { id: "elegant", label: "優雅" },
  { id: "impact", label: "強烈" },
  { id: "minimal", label: "極簡" },
  { id: "fx", label: "特效" },
];

/** [r, g, b, a] — a 為 0~255 */
export type SubtitleColor = [number, number, number, number];

/** 進場方式(由 ffmpeg 的 overlay 位置與 alpha 淡入實作) */
export type SubtitleAnimation = "none" | "fade" | "slide-up" | "pop";

export type SubtitleStyle = {
  id: string;
  label: string;
  description: string;
  category: SubtitleCategory;
  moods: MusicMood[];
  available: boolean;
  unavailableReason?: string;

  /** 對應 src/lib/video/fonts.ts 的字體 id */
  fontId: string;
  /** 相對基準字級(74px)的倍率 */
  fontScale: number;
  fill: SubtitleColor;
  stroke: SubtitleColor;
  /** 描邊粗細(像素半徑),0 表示不描邊 */
  strokeWidth: number;
  /** 只留描邊、字心鏤空 */
  hollow?: boolean;
  /** 文字底條 */
  background?: {
    color: SubtitleColor;
    paddingX: number;
    paddingY: number;
    radius: number;
  };
  /** 由上到下的漸層填色(設了就取代 fill) */
  gradient?: { from: SubtitleColor; to: SubtitleColor };
  /** 外光暈(霓虹效果) */
  glow?: { color: SubtitleColor; radius: number };
  animation: SubtitleAnimation;

  /** 前端預覽用 */
  cssColor: string;
  cssShadow: string;
  cssBackground: string;
  cssWeight: number;
  /** 額外的預覽宣告(漸層字、純描邊之類的) */
  cssExtra?: string;
};

export const SUBTITLE_STYLES: SubtitleStyle[] = [
  {
    id: "classic-white",
    label: "經典白條",
    description: "白字加半透明黑底條 — 任何背景都看得清楚",
    category: "classic",
    moods: ["elegant", "chill", "upbeat", "energetic", "cinematic"],
    available: true,
    fontId: "sans",
    fontScale: 1,
    fill: [255, 255, 255, 255],
    stroke: [0, 0, 0, 0],
    strokeWidth: 0,
    background: {
      color: [0, 0, 0, 128],
      paddingX: 36,
      paddingY: 18,
      radius: 14,
    },
    animation: "none",
    cssColor: "#ffffff",
    cssShadow: "none",
    cssBackground: "rgba(0,0,0,.5)",
    cssWeight: 500,
  },
  {
    id: "elegant-serif",
    label: "優雅金明體",
    description: "香檳金明體配深色陰影 — 紋繡、護膚、質感作品",
    category: "elegant",
    moods: ["elegant", "cinematic"],
    available: true,
    fontId: "serif",
    fontScale: 1,
    fill: [255, 243, 208, 255],
    stroke: [90, 60, 10, 215],
    strokeWidth: 6,
    animation: "fade",
    cssColor: "#fff3d0",
    cssShadow: "0 0 8px rgba(90,60,10,.95)",
    cssBackground: "transparent",
    cssWeight: 500,
  },
  {
    id: "bold-impact",
    label: "強力粗黑",
    description: "放大加重的白字黑框 — 促銷、標題、要人一眼看到",
    category: "impact",
    moods: ["energetic", "upbeat"],
    available: true,
    fontId: "sans",
    fontScale: 1.28,
    fill: [255, 255, 255, 255],
    stroke: [0, 0, 0, 240],
    strokeWidth: 11,
    animation: "pop",
    cssColor: "#ffffff",
    cssShadow:
      "-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 0 10px rgba(0,0,0,.8)",
    cssBackground: "transparent",
    cssWeight: 700,
  },
  {
    id: "minimal",
    label: "極簡小字",
    description: "縮小的白字、幾乎沒有裝飾 — 不搶畫面",
    category: "minimal",
    moods: ["chill", "elegant"],
    available: true,
    fontId: "sans",
    fontScale: 0.72,
    fill: [255, 255, 255, 245],
    stroke: [0, 0, 0, 120],
    strokeWidth: 2,
    animation: "none",
    cssColor: "rgba(255,255,255,.96)",
    cssShadow: "0 1px 3px rgba(0,0,0,.5)",
    cssBackground: "transparent",
    cssWeight: 400,
  },
  {
    id: "magazine",
    label: "雜誌文楷",
    description: "文楷字配直角底條 — 排版帶點刊物味",
    category: "elegant",
    moods: ["elegant", "chill"],
    available: true,
    fontId: "kai",
    fontScale: 1.05,
    fill: [255, 252, 245, 255],
    stroke: [60, 45, 35, 180],
    strokeWidth: 4,
    background: {
      color: [26, 20, 24, 150],
      paddingX: 44,
      paddingY: 22,
      radius: 0,
    },
    animation: "fade",
    cssColor: "#fffcf5",
    cssShadow: "0 0 6px rgba(60,45,35,.7)",
    cssBackground: "rgba(26,20,24,.59)",
    cssWeight: 400,
  },
  {
    id: "neon-glow",
    label: "霓虹發光",
    description: "粉紫外光暈的發光字 — 夜店感、指甲彩繪很吃這套",
    category: "fx",
    moods: ["energetic", "upbeat"],
    available: true,
    fontId: "sans",
    fontScale: 1.05,
    fill: [255, 255, 255, 255],
    stroke: [255, 64, 180, 225],
    strokeWidth: 4,
    glow: { color: [255, 64, 180, 210], radius: 16 },
    animation: "fade",
    cssColor: "#ffffff",
    cssShadow:
      "0 0 6px #ff40b4, 0 0 14px #ff40b4, 0 0 28px rgba(255,64,180,.75)",
    cssBackground: "transparent",
    cssWeight: 600,
  },
  {
    id: "typewriter",
    label: "打字機",
    description: "文字逐字顯現",
    category: "fx",
    moods: ["chill", "cinematic"],
    available: false,
    unavailableReason: "需要逐字逐格運算,目前的影片管線做不到",
    fontId: "sans",
    fontScale: 1,
    fill: [255, 255, 255, 255],
    stroke: [0, 0, 0, 200],
    strokeWidth: 6,
    animation: "none",
    cssColor: "#ffffff",
    cssShadow: "0 0 6px rgba(0,0,0,.9)",
    cssBackground: "transparent",
    cssWeight: 500,
  },
  {
    id: "slide-up",
    label: "滑入淡入",
    description: "字從下方滑上來同時淡入 — 開場最順的一款",
    category: "fx",
    moods: ["chill", "elegant"],
    available: true,
    fontId: "sans",
    fontScale: 1,
    fill: [255, 255, 255, 255],
    stroke: [0, 0, 0, 205],
    strokeWidth: 6,
    animation: "slide-up",
    cssColor: "#ffffff",
    cssShadow: "0 0 6px rgba(0,0,0,.85)",
    cssBackground: "transparent",
    cssWeight: 500,
  },
  {
    id: "pop-in",
    label: "彈出",
    description: "快速淡入帶一點回彈 — 活潑、有節奏",
    category: "fx",
    moods: ["upbeat", "energetic"],
    available: true,
    fontId: "huninn",
    fontScale: 1.1,
    fill: [255, 233, 238, 255],
    stroke: [120, 40, 60, 225],
    strokeWidth: 7,
    animation: "pop",
    cssColor: "#ffe9ee",
    cssShadow: "0 0 8px rgba(120,40,60,.95)",
    cssBackground: "transparent",
    cssWeight: 600,
  },
  {
    id: "karaoke",
    label: "逐字變色",
    description: "高亮由左到右掃過文字",
    category: "fx",
    moods: ["upbeat", "energetic"],
    available: false,
    unavailableReason: "需要逐字逐格運算,目前的影片管線做不到",
    fontId: "sans",
    fontScale: 1,
    fill: [255, 255, 255, 255],
    stroke: [0, 0, 0, 200],
    strokeWidth: 6,
    animation: "none",
    cssColor: "#ffffff",
    cssShadow: "0 0 6px rgba(0,0,0,.9)",
    cssBackground: "transparent",
    cssWeight: 500,
  },
  {
    id: "outline-only",
    label: "純描邊",
    description: "只有輪廓、字心鏤空 — 讓畫面透出來",
    category: "minimal",
    moods: ["cinematic", "chill"],
    available: true,
    fontId: "sans",
    fontScale: 1.08,
    fill: [255, 255, 255, 0],
    stroke: [255, 255, 255, 245],
    strokeWidth: 5,
    hollow: true,
    animation: "none",
    cssColor: "transparent",
    cssShadow: "none",
    cssBackground: "transparent",
    cssWeight: 700,
    cssExtra:
      "-webkit-text-stroke:1.5px rgba(255,255,255,.96);paint-order:stroke fill",
  },
  {
    id: "gradient-text",
    label: "漸層字",
    description: "由粉到金的漸層填色 — 華麗但不吵",
    category: "fx",
    moods: ["elegant", "upbeat"],
    available: true,
    fontId: "sans",
    fontScale: 1.05,
    fill: [255, 190, 214, 255],
    stroke: [58, 28, 42, 210],
    strokeWidth: 4,
    gradient: { from: [255, 190, 214, 255], to: [206, 158, 62, 255] },
    animation: "fade",
    cssColor: "transparent",
    cssShadow: "none",
    cssBackground: "transparent",
    cssWeight: 600,
    cssExtra:
      "background-image:linear-gradient(180deg,#ffd1dc,#c5a55a);-webkit-background-clip:text;background-clip:text;filter:drop-shadow(0 0 5px rgba(60,30,45,.8))",
  },
];

export function subtitleStyleById(
  id: string | null | undefined
): SubtitleStyle {
  if (!id) return SUBTITLE_STYLES[0];
  return SUBTITLE_STYLES.find((s) => s.id === id) ?? SUBTITLE_STYLES[0];
}

/** 取某個氛圍適合的字幕風格(經典白條永遠排最前面當保底) */
export function subtitleStylesByMood(mood: string): SubtitleStyle[] {
  const matched = SUBTITLE_STYLES.filter(
    (s) =>
      s.id !== "classic-white" &&
      s.available &&
      s.moods.includes(mood as MusicMood)
  );
  return [SUBTITLE_STYLES[0], ...matched];
}

export function subtitleStylesByCategory(category: string): SubtitleStyle[] {
  return SUBTITLE_STYLES.filter((s) => s.category === category);
}
