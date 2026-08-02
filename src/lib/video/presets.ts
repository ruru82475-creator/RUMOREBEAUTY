// 美顏(磨皮)強度定義
//
// 註:風格濾鏡已整併到 src/lib/resources/filters.ts(15 組,每組含 ffmpeg 濾鏡鏈)。
//     這裡轉出舊名稱讓既有引用不中斷,新程式碼請直接引用 @/lib/resources/filters。
export {
  VISUAL_FILTERS as FILTER_PRESETS,
  filterById as presetById,
} from "@/lib/resources/filters";
export type { VisualFilter as FilterPreset } from "@/lib/resources/filters";

// bilateral 為主,搭配輕微銳化保留細節
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

export function beautyById(id: string) {
  return BEAUTY_LEVELS.find((b) => b.id === id) ?? BEAUTY_LEVELS[0];
}
