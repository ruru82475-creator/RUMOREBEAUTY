// 視覺濾鏡資源庫(前後端共用,不可引用 Node 專用模組)
//
// 每組濾鏡帶「兩份」定義:
//   css   → 前端即時預覽(瀏覽器看得懂)
//   chain → ffmpeg 濾鏡鏈,這份才是真正渲染進影片檔的
// 兩份必須維持一致,否則預覽跟成品會對不起來。
//
// 分類標籤也有兩套:
//   moods    → 與音樂庫共用的 5 種氛圍,給「一鍵配好全套」與 AI 用
//   category → 濾鏡自己的色溫分類,給手動瀏覽的分頁籤用
import type { MusicMood } from "./music";

export type FilterCategory =
  | "warm"
  | "cool"
  | "neutral"
  | "vintage"
  | "achromatic";

export const FILTER_CATEGORIES: { id: FilterCategory; label: string }[] = [
  { id: "warm", label: "暖色" },
  { id: "cool", label: "冷色" },
  { id: "neutral", label: "中性" },
  { id: "vintage", label: "復古" },
  { id: "achromatic", label: "無彩" },
];

export type VisualFilter = {
  id: string;
  label: string;
  description: string;
  category: FilterCategory;
  moods: MusicMood[];
  /** 舊代號(資料庫既有模板存的值),用於相容對照 */
  aliases?: string[];
  /** 前端即時預覽用 */
  css: string;
  /** 選擇器縮圖的色塊(CSS background) */
  swatch: string;
  /** ffmpeg 濾鏡鏈 — 真正渲染進影片的那份 */
  chain: string[];
};

export const VISUAL_FILTERS: VisualFilter[] = [
  {
    id: "none",
    label: "原始",
    description: "不加任何調色,保留相機原本的畫面",
    category: "neutral",
    moods: ["elegant", "chill", "upbeat", "energetic", "cinematic"],
    css: "",
    swatch: "linear-gradient(135deg,#8e8e93,#c7c7cc)",
    chain: [],
  },
  {
    id: "sunlit",
    label: "暖陽",
    description: "灑進來的自然光感,膚色暖而不油",
    category: "warm",
    moods: ["upbeat", "chill"],
    css: "brightness(1.05) saturate(1.2) sepia(0.15)",
    swatch: "linear-gradient(135deg,#ffd9a0,#f2a65a)",
    chain: [
      "eq=brightness=0.05:saturation=1.2",
      "colorbalance=rs=0.09:gs=0.03:bs=-0.07",
    ],
  },
  {
    id: "porcelain",
    label: "冷調",
    description: "偏冷的白皙通透感,乾淨俐落",
    category: "cool",
    moods: ["elegant", "cinematic"],
    aliases: ["cool"],
    css: "brightness(1.12) contrast(1.05) saturate(0.95) hue-rotate(-6deg)",
    swatch: "linear-gradient(135deg,#e8f2fb,#b9cfe3)",
    chain: [
      "eq=brightness=0.1:contrast=1.06:saturation=0.95",
      "colorbalance=rs=-0.04:gs=0.01:bs=0.08",
    ],
  },
  {
    id: "retro",
    label: "復古",
    description: "膠片顆粒與暗角,帶記憶點的懷舊氛圍",
    category: "vintage",
    moods: ["cinematic", "elegant"],
    css: "contrast(1.15) saturate(1.2) sepia(0.2)",
    swatch: "linear-gradient(135deg,#d9b98c,#8a6a4a)",
    chain: [
      "eq=contrast=1.14:saturation=1.18:brightness=-0.02",
      "colorbalance=rs=0.08:gs=0.02:bs=-0.08",
      "noise=alls=8:allf=t",
      "vignette=PI/5",
    ],
  },
  {
    id: "cinematic",
    label: "電影感",
    description: "壓暗提對比,冷影調暖高光的電影配色",
    category: "neutral",
    moods: ["cinematic"],
    css: "contrast(1.15) brightness(0.92) saturate(1.1)",
    swatch: "linear-gradient(135deg,#2f4858,#c98f5a)",
    chain: [
      "eq=contrast=1.15:brightness=-0.06:saturation=1.1",
      "colorbalance=rs=-0.05:bs=0.08:rh=0.06:bh=-0.04",
    ],
  },
  {
    id: "peach",
    label: "粉嫩",
    description: "甜美粉調,美甲與唇部作品很搭",
    category: "warm",
    moods: ["upbeat"],
    aliases: ["pink"],
    css: "brightness(1.06) saturate(1.12) hue-rotate(4deg)",
    swatch: "linear-gradient(135deg,#ffd7e2,#f7a8b8)",
    chain: [
      "eq=brightness=0.05:saturation=1.12",
      "colorbalance=rs=0.1:gs=-0.01:bs=0.04",
    ],
  },
  {
    id: "clear",
    label: "清透",
    description: "提亮降對比,水感清爽不厚重",
    category: "cool",
    moods: ["chill", "elegant"],
    css: "brightness(1.12) contrast(0.95) saturate(1.05)",
    swatch: "linear-gradient(135deg,#f2fbff,#cfe8f0)",
    chain: ["eq=brightness=0.12:contrast=0.95:saturation=1.05"],
  },
  {
    id: "cream",
    label: "奶茶色",
    description: "溫潤柔和的奶茶膚調,特寫的萬用款",
    category: "warm",
    moods: ["elegant", "chill"],
    aliases: ["milktea"],
    css: "brightness(1.08) saturate(0.95) contrast(0.98) sepia(0.08)",
    swatch: "linear-gradient(135deg,#f6e3d0,#d8b79a)",
    chain: [
      "eq=brightness=0.07:saturation=0.94:contrast=0.98",
      "colorbalance=rs=0.06:gs=0.02:bs=0.01",
    ],
  },
  {
    id: "muted",
    label: "高級灰",
    description: "低飽和的雜誌質感,材質與線條特別出色",
    category: "achromatic",
    moods: ["chill", "cinematic"],
    css: "saturate(0.62) contrast(1.08) brightness(1.03)",
    swatch: "linear-gradient(135deg,#d5d2ce,#9a9691)",
    chain: ["eq=saturation=0.62:contrast=1.08:brightness=0.03"],
  },
  {
    id: "airy",
    label: "日系",
    description: "低對比高明亮的日雜空氣感,柔和不刺眼",
    category: "neutral",
    moods: ["chill"],
    css: "brightness(1.14) contrast(0.9) saturate(0.92)",
    swatch: "linear-gradient(135deg,#fdf6ef,#e3dcd2)",
    chain: [
      "eq=brightness=0.12:contrast=0.9:saturation=0.92",
      "colorbalance=rs=0.01:gs=0.02:bs=0.05",
    ],
  },
  {
    id: "korean",
    label: "韓系",
    description: "清晰銳利帶微冷,韓系妝髮質感",
    category: "cool",
    moods: ["upbeat", "elegant"],
    css: "brightness(1.05) contrast(1.08) saturate(1.1) hue-rotate(-5deg)",
    swatch: "linear-gradient(135deg,#ffeef0,#cdd9e5)",
    chain: ["eq=brightness=0.05:contrast=1.08:saturation=1.1", "hue=h=-5"],
  },
  {
    id: "sunset",
    label: "夕陽",
    description: "濃郁橙紅的黃昏色溫,情緒感強烈",
    category: "warm",
    moods: ["cinematic", "energetic"],
    css: "sepia(0.25) saturate(1.3) hue-rotate(-15deg) brightness(1.05)",
    swatch: "linear-gradient(135deg,#ffb07c,#d1495b)",
    chain: [
      "eq=brightness=0.05:saturation=1.3",
      "hue=h=-12",
      "colorbalance=rs=0.12:gs=0.02:bs=-0.1",
    ],
  },
  {
    id: "forest",
    label: "森林",
    description: "偏綠的自然沉靜色調,植感與木質調很搭",
    category: "cool",
    moods: ["chill", "cinematic"],
    css: "saturate(1.2) hue-rotate(15deg) brightness(0.98)",
    swatch: "linear-gradient(135deg,#a8c69f,#4a6b4f)",
    chain: ["eq=saturation=1.2:brightness=-0.02", "hue=h=15"],
  },
  {
    id: "noir",
    label: "黑金",
    description: "近黑白的高反差,高光留一點金,線條與紋理最搶眼",
    category: "achromatic",
    moods: ["cinematic"],
    // 舊的「黑白質感」模板沿用這一組(近乎去色 + 強對比)
    aliases: ["mono"],
    css: "saturate(0.3) contrast(1.3) brightness(0.9)",
    swatch: "linear-gradient(135deg,#3a3a3a,#c5a55a)",
    chain: [
      "eq=saturation=0.3:contrast=1.3:brightness=-0.08",
      "colorbalance=rh=0.06:gh=0.03:bh=-0.05",
    ],
  },
  {
    id: "dreamy",
    label: "夢幻",
    description: "柔焦朦朧的低對比,像隔著一層光",
    category: "warm",
    moods: ["elegant", "chill"],
    css: "brightness(1.15) saturate(1.2) contrast(0.85) blur(0.3px)",
    swatch: "linear-gradient(135deg,#ffe9f3,#dcd0f5)",
    chain: [
      "eq=brightness=0.15:saturation=1.2:contrast=0.85",
      "gblur=sigma=0.8",
    ],
  },
];

/** 依 id 取濾鏡(找不到就回原始畫面);舊代號會自動對到新的那一組 */
export function filterById(id: string | null | undefined): VisualFilter {
  if (!id) return VISUAL_FILTERS[0];
  return (
    VISUAL_FILTERS.find((f) => f.id === id) ??
    VISUAL_FILTERS.find((f) => f.aliases?.includes(id)) ??
    VISUAL_FILTERS[0]
  );
}

/** 取某個氛圍適合的濾鏡(「原始」永遠排在最前面當保底) */
export function filtersByMood(mood: string): VisualFilter[] {
  const matched = VISUAL_FILTERS.filter(
    (f) => f.id !== "none" && f.moods.includes(mood as MusicMood)
  );
  return [VISUAL_FILTERS[0], ...matched];
}

export function filtersByCategory(category: string): VisualFilter[] {
  return VISUAL_FILTERS.filter((f) => f.category === category);
}
