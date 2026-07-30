// 字幕可選字體(皆為開源可商用授權,繁體覆蓋率 100%)
// 字型檔放在 src/assets/fonts/,由 caption.ts 讀取輪廓渲染
export type CaptionFont = {
  id: string;
  label: string;
  file: string;
  /** 前端預覽用的近似字體堆疊 */
  cssStack: string;
};

export const CAPTION_FONTS: CaptionFont[] = [
  {
    id: "huninn",
    label: "粉圓體",
    file: "jf-openhuninn.ttf",
    cssStack: '"jf-openhuninn", "Yuanti TC", "PingFang TC", sans-serif',
  },
  {
    id: "sans",
    label: "俐落黑體",
    file: "cjk-sans.ttf",
    cssStack: '"Noto Sans TC", "PingFang TC", sans-serif',
  },
  {
    id: "serif",
    label: "優雅明體",
    file: "cjk-serif.ttf",
    cssStack: '"Noto Serif TC", "Songti TC", serif',
  },
  {
    id: "kai",
    label: "文楷",
    file: "cjk-kai.ttf",
    cssStack: '"LXGW WenKai TC", "Kaiti TC", "DFKai-SB", serif',
  },
];

export function fontById(id: string): CaptionFont {
  return CAPTION_FONTS.find((f) => f.id === id) ?? CAPTION_FONTS[0];
}
