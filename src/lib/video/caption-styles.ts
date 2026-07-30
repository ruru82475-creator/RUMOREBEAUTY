// 字幕配色定義(前後端共用:伺服器渲染用 RGBA,前端預覽用 CSS)
// 此檔不可 import 任何 Node 專用模組,前端元件會直接引用
export type CaptionStyleDef = {
  id: string;
  label: string;
  fill: [number, number, number, number];
  stroke: [number, number, number, number];
  cssFill: string;
  cssShadow: string;
};

export const CAPTION_STYLE_LABELS: CaptionStyleDef[] = [
  {
    id: "classic",
    label: "白字黑邊",
    fill: [255, 255, 255, 255],
    stroke: [0, 0, 0, 200],
    cssFill: "#ffffff",
    cssShadow: "0 0 6px rgba(0,0,0,.9)",
  },
  {
    id: "rose",
    label: "玫瑰金",
    fill: [255, 233, 238, 255],
    stroke: [120, 40, 60, 215],
    cssFill: "#ffe9ee",
    cssShadow: "0 0 6px rgba(120,40,60,.95)",
  },
  {
    id: "gold",
    label: "香檳金",
    fill: [255, 243, 208, 255],
    stroke: [90, 60, 10, 215],
    cssFill: "#fff3d0",
    cssShadow: "0 0 6px rgba(90,60,10,.95)",
  },
  {
    id: "ink",
    label: "黑字白邊",
    fill: [27, 18, 24, 255],
    stroke: [255, 255, 255, 225],
    cssFill: "#1b1218",
    cssShadow: "0 0 6px rgba(255,255,255,.95)",
  },
];

export function captionStyleById(id: string): CaptionStyleDef {
  return (
    CAPTION_STYLE_LABELS.find((s) => s.id === id) ?? CAPTION_STYLE_LABELS[0]
  );
}
