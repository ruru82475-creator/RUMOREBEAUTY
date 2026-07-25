// 美圖秀秀風格的影片濾鏡預設
// 每個預設 = ffmpeg 濾鏡鏈(伺服器套用)+ CSS 近似值(前端即時預覽)
// 註:ffmpeg 濾鏡若該版本不支援會自動跳過(見 ffmpeg.ts 的 availableFilters)

export type FilterPreset = {
  id: string;
  label: string;
  description: string;
  css: string; // 前端預覽用
  chain: string[]; // ffmpeg 濾鏡
};

export const FILTER_PRESETS: FilterPreset[] = [
  {
    id: "none",
    label: "原始畫面",
    description: "不加任何調色",
    css: "",
    chain: [],
  },
  {
    id: "cream",
    label: "奶油肌",
    description: "溫潤柔和的膚色,適合特寫與人像",
    css: "brightness(1.08) saturate(0.95) contrast(0.98) sepia(0.08)",
    chain: [
      "eq=brightness=0.07:saturation=0.94:contrast=0.98",
      "colorbalance=rs=0.06:gs=0.02:bs=0.01",
    ],
  },
  {
    id: "porcelain",
    label: "冷白皮",
    description: "透亮偏冷的白皙感,乾淨俐落",
    css: "brightness(1.12) contrast(1.05) saturate(0.95) hue-rotate(-6deg)",
    chain: [
      "eq=brightness=0.1:contrast=1.06:saturation=0.95",
      "colorbalance=rs=-0.04:gs=0.01:bs=0.08",
    ],
  },
  {
    id: "peach",
    label: "蜜桃粉",
    description: "甜美粉嫩色調,美甲與唇部作品很搭",
    css: "brightness(1.06) saturate(1.12) hue-rotate(4deg)",
    chain: [
      "eq=brightness=0.05:saturation=1.12",
      "colorbalance=rs=0.1:gs=-0.01:bs=0.04",
    ],
  },
  {
    id: "airy",
    label: "日系清透",
    description: "低對比高明亮,空氣感日雜風",
    css: "brightness(1.14) contrast(0.9) saturate(0.92)",
    chain: [
      "eq=brightness=0.12:contrast=0.9:saturation=0.92",
      "colorbalance=rs=0.01:gs=0.02:bs=0.05",
    ],
  },
  {
    id: "retro",
    label: "港風復古",
    description: "帶顆粒與暗角的膠片氛圍",
    css: "contrast(1.15) saturate(1.2) sepia(0.2)",
    chain: [
      "eq=contrast=1.14:saturation=1.18:brightness=-0.02",
      "colorbalance=rs=0.08:gs=0.02:bs=-0.08",
      "noise=alls=8:allf=t",
      "vignette=PI/5",
    ],
  },
  {
    id: "muted",
    label: "高級灰",
    description: "低飽和質感風,作品照很有雜誌感",
    css: "saturate(0.62) contrast(1.08) brightness(1.03)",
    chain: ["eq=saturation=0.62:contrast=1.08:brightness=0.03"],
  },
  {
    id: "mono",
    label: "黑白質感",
    description: "純黑白,強調線條與紋理",
    css: "grayscale(1) contrast(1.2)",
    chain: ["hue=s=0", "eq=contrast=1.2:brightness=0.02"],
  },
];

// 美顏(磨皮)強度:bilateral 為主,搭配輕微銳化保留細節
export type BeautyLevel = "off" | "natural" | "standard" | "strong";

export const BEAUTY_LEVELS: {
  id: BeautyLevel;
  label: string;
  chain: string[];
}[] = [
  { id: "off", label: "關閉", chain: [] },
  {
    id: "natural",
    label: "自然",
    chain: ["bilateral=sigmaS=6:sigmaR=0.06", "unsharp=3:3:0.3"],
  },
  {
    id: "standard",
    label: "標準",
    chain: ["bilateral=sigmaS=12:sigmaR=0.1", "unsharp=5:5:0.5"],
  },
  {
    id: "strong",
    label: "強",
    chain: ["bilateral=sigmaS=20:sigmaR=0.16", "unsharp=5:5:0.8"],
  },
];

export function presetById(id: string): FilterPreset {
  return FILTER_PRESETS.find((p) => p.id === id) ?? FILTER_PRESETS[0];
}

export function beautyById(id: string) {
  return BEAUTY_LEVELS.find((b) => b.id === id) ?? BEAUTY_LEVELS[0];
}
