import { GoogleGenAI, type Part } from "@google/genai";
import type {
  AIProvider,
  RecommendCandidate,
  StyleRecommendation,
} from "./provider";

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

  async analyzeAndRecommend({
    images,
    templates,
    filters,
    fonts,
    subtitleStyles,
  }: {
    images: { base64: string; mimeType: string }[];
    templates: RecommendCandidate[];
    filters: RecommendCandidate[];
    fonts: RecommendCandidate[];
    subtitleStyles: RecommendCandidate[];
  }): Promise<StyleRecommendation> {
    const list = (items: RecommendCandidate[]) =>
      items
        .map((i) => `  - ${i.id}:${i.name}${i.description ? ` — ${i.description}` : ""}`)
        .join("\n");

    const systemPrompt = `你是美容產業的社群影片後製顧問,服務對象是台灣的美容創作者(美甲、美睫、紋繡、3D 列印客製)。
你會看到一支素材影片的三張代表畫面,請判斷畫面內容,從下列選項中挑出最適合的組合。

可選的風格模板:
${list(templates)}

可選的畫面色調:
${list(filters)}

可選的字幕字體:
${list(fonts)}

可選的字幕配色:
${list(subtitleStyles)}

磨皮強度只能填:off(關閉)、natural(自然)、standard(標準)、strong(強)
 — 有人物皮膚入鏡時建議 standard;只有物件、器材、成品時建議 off 或 natural。

字幕文案要求:繁體中文(台灣用語)、12 個字以內、像美容師本人在社群發文的口吻,
可用「✦」「·」等簡單符號,不要用 hashtag,不要誇大療效。

音樂氛圍請用英文關鍵字(2~4 個字),之後會拿去搜尋免費音樂庫,例如:soft piano、cute upbeat。

只回傳 JSON,不要有其他文字或 markdown 符號:
{"templateId":"","filterPreset":"","beauty":"","subtitleStyle":"","subtitleFont":"","caption":"","musicMood":"","reason":""}

reason 用一句繁體中文說明為什麼這樣搭配。`;

    const parts: Part[] = [
      ...images.map((img) => ({
        inlineData: { data: img.base64, mimeType: img.mimeType },
      })),
      {
        text: "以上是影片前段、中段、後段的畫面,請依規定格式回傳 JSON 建議。",
      },
    ];

    const raw = await this.request(systemPrompt, parts);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("AI 回覆格式異常,請再試一次");
    }

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const pick = (
      value: unknown,
      options: RecommendCandidate[],
      fallback: string
    ) => {
      const id = typeof value === "string" ? value.trim() : "";
      return options.some((o) => o.id === id) ? id : fallback;
    };

    const templateId = pick(parsed.templateId, templates, "");
    const beautyRaw =
      typeof parsed.beauty === "string" ? parsed.beauty.trim() : "";

    return {
      templateId: templateId || null,
      templateName:
        templates.find((t) => t.id === templateId)?.name ?? null,
      filterPreset: pick(parsed.filterPreset, filters, "none"),
      beauty: ["off", "natural", "standard", "strong"].includes(beautyRaw)
        ? beautyRaw
        : "natural",
      subtitleStyle: pick(parsed.subtitleStyle, subtitleStyles, "classic"),
      subtitleFont: pick(parsed.subtitleFont, fonts, "huninn"),
      caption:
        typeof parsed.caption === "string"
          ? parsed.caption.trim().slice(0, 40)
          : "",
      musicMood:
        typeof parsed.musicMood === "string"
          ? parsed.musicMood.trim().slice(0, 40)
          : "soft background",
      reason:
        typeof parsed.reason === "string"
          ? parsed.reason.trim().slice(0, 120)
          : "",
    };
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
