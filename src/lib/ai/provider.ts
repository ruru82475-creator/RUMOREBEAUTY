// AI 看過素材後給的整套風格建議
export type StyleRecommendation = {
  templateId: string | null;
  templateName: string | null;
  filterPreset: string; // 對應 presets.ts 的色調 id
  beauty: string; // 磨皮強度 id
  subtitleStyle: string; // 字幕配色 id
  subtitleFont: string; // 字體 id
  caption: string; // AI 代擬的字幕文案
  musicMood: string; // 音樂氛圍關鍵字(英文,供音樂搜尋)
  reason: string; // 一句話說明推薦原因(繁體中文)
};

export type RecommendCandidate = {
  id: string;
  name: string;
  description: string;
};

// AI 引擎統一介面:未來換 Claude 或其他 API 只需實作這個介面
export interface AIProvider {
  /** 影格分析:接收 base64 圖片陣列,回傳文字分析結果 */
  analyzeFrames(params: {
    images: { base64: string; mimeType: string }[];
    systemPrompt: string;
    userPrompt: string;
  }): Promise<string>;

  /** 純文字生成(行銷文案、拍攝指令等) */
  generateText(params: {
    systemPrompt: string;
    userPrompt: string;
  }): Promise<string>;

  /** 看影片代表幀 → 推薦整套後製風格(模板、濾鏡、字幕、配樂) */
  analyzeAndRecommend(params: {
    images: { base64: string; mimeType: string }[];
    templates: RecommendCandidate[];
    filters: RecommendCandidate[];
    fonts: RecommendCandidate[];
    subtitleStyles: RecommendCandidate[];
  }): Promise<StyleRecommendation>;
}
