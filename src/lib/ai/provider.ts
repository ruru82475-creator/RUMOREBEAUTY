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
}
