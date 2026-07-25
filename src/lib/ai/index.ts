import type { AIProvider } from "./provider";
import { GeminiProvider } from "./gemini";

// 工廠函數:依環境變數決定使用哪個 AI 引擎
//   GEMINI_API_KEY 存在 → Gemini(免費,目前使用)
//   ANTHROPIC_API_KEY 存在 → Claude(未來擴充)
export function getAIProvider(): AIProvider {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    return new GeminiProvider(geminiKey);
  }

  if (process.env.ANTHROPIC_API_KEY) {
    // 之後在此加入 ClaudeProvider
    throw new Error("Claude 引擎尚未實作,請先設定 GEMINI_API_KEY。");
  }

  throw new Error("未設定 AI 金鑰,請在環境變數填入 GEMINI_API_KEY。");
}

export type { AIProvider } from "./provider";
