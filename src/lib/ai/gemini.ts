import { GoogleGenAI, type Part } from "@google/genai";
import type { AIProvider } from "./provider";

// Gemini 實作(目前使用的免費引擎)
// 模型:gemini-flash-latest 自動指向最新穩定 flash 版,避免模型退役造成 404
// (2026-07 當下實際指向 gemini-3.x flash;要固定版本可改成 "gemini-3.5-flash" 等)
const MODEL = "gemini-flash-latest";
const TIMEOUT_MS = 30_000; // 單次請求 30 秒超時
const RATE_LIMIT_WAIT_MS = 60_000; // 429 時等待 60 秒
const MAX_RETRIES = 2; // 429 最多重試 2 次

export class GeminiProvider implements AIProvider {
  private client: GoogleGenAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async analyzeFrames({
    images,
    systemPrompt,
    userPrompt,
  }: {
    images: { base64: string; mimeType: string }[];
    systemPrompt: string;
    userPrompt: string;
  }): Promise<string> {
    const parts: Part[] = [
      ...images.map((img) => ({
        inlineData: { data: img.base64, mimeType: img.mimeType },
      })),
      { text: userPrompt },
    ];
    return this.request(systemPrompt, parts);
  }

  async generateText({
    systemPrompt,
    userPrompt,
  }: {
    systemPrompt: string;
    userPrompt: string;
  }): Promise<string> {
    return this.request(systemPrompt, [{ text: userPrompt }]);
  }

  private async request(
    systemInstruction: string,
    parts: Part[],
    attempt = 0
  ): Promise<string> {
    try {
      const response = await withTimeout(
        this.client.models.generateContent({
          model: MODEL,
          contents: [{ role: "user", parts }],
          config: { systemInstruction },
        }),
        TIMEOUT_MS
      );
      return response.text ?? "";
    } catch (error) {
      if (isRateLimit(error) && attempt < MAX_RETRIES) {
        await sleep(RATE_LIMIT_WAIT_MS);
        return this.request(systemInstruction, parts, attempt + 1);
      }
      throw error;
    }
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`AI 請求逾時(${ms / 1000} 秒)`)), ms)
    ),
  ]);
}

function isRateLimit(error: unknown): boolean {
  const status = (error as { status?: number })?.status;
  if (status === 429) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /429|RESOURCE_EXHAUSTED|rate limit/i.test(message);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
