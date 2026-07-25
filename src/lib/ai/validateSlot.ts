import { getAIProvider } from "./index";
import type { TemplateSlot } from "@/types/video";

// 槽位素材 AI 驗證(核心邏輯)
// 收到影片的三張代表幀,對照槽位需求判斷是否合格,回傳繁中回饋
// 註:目前 validate-slot API 為寬鬆模式(STRICT_AI_CHECK=false),
//    此檢查僅在切回嚴格模式時生效
export type SlotValidationResult = {
  pass: boolean;
  feedback: string;
  confidence?: number;
  issues?: string[];
  retakeTips?: string[];
  contentMatch?: string;
};

const SHOT_TYPE_LABEL: Record<TemplateSlot["shot_type"], string> = {
  wide: "全景(wide)",
  medium: "中景(medium)",
  "close-up": "特寫(close-up)",
};

// 官方 System prompt(依規格逐字使用,僅將槽位資料代入)
function buildSystemPrompt(slot: TemplateSlot): string {
  return `你是一位專業的美容產業影片拍攝總監。
你的任務是檢查使用者拍攝的影片素材是否符合拍攝要求。

拍攝要求：
- 槽位名稱：${slot.name}
- 拍攝指令：${slot.instruction}
- 景別要求：${SHOT_TYPE_LABEL[slot.shot_type] ?? slot.shot_type}
- 構圖提示：${slot.composition_hint}
- 內容要求：${slot.validation.required_content}

請分析提供的三幀影片截圖（分別來自影片的前段、中段、後段），判斷：
1. 畫面內容是否符合要求的主題
2. 景別是否正確（特寫/中景/全景）
3. 亮度是否充足（美容影片需要明亮光線）
4. 畫面是否穩定清晰（不模糊）

請嚴格以 JSON 格式回傳，不要有任何其他文字：
{
  "pass": true 或 false,
  "confidence": 0 到 1 的信心分數,
  "issues": ["問題描述1", "問題描述2"],
  "retake_tips": ["具體的重拍建議1", "具體的重拍建議2"],
  "content_match": "簡述畫面內容與要求的符合程度"
}`;
}

export async function validateSlot(params: {
  frames: { base64: string; mimeType: string }[];
  slot: TemplateSlot;
  durationSec: number;
}): Promise<SlotValidationResult> {
  const { frames, slot } = params;
  const ai = getAIProvider();

  const raw = await ai.analyzeFrames({
    images: frames,
    systemPrompt: buildSystemPrompt(slot),
    userPrompt:
      "以下三張圖依序是影片前段、中段、後段的截圖,請分析並依規定格式回傳 JSON。",
  });

  // 容忍 AI 把 JSON 包在 code fence 或多餘文字裡
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { pass: false, feedback: "AI 回覆格式異常,請再送出一次。" };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as {
      pass?: unknown;
      confidence?: unknown;
      issues?: unknown;
      retake_tips?: unknown;
      content_match?: unknown;
    };

    const pass = parsed.pass === true;
    const issues = toStringArray(parsed.issues);
    const retakeTips = toStringArray(parsed.retake_tips);
    const contentMatch =
      typeof parsed.content_match === "string" ? parsed.content_match : "";

    // 組合給使用者看的一段話
    let feedback: string;
    if (pass) {
      feedback = contentMatch || "畫面符合需求,拍得很好!";
    } else {
      const issueText = issues.length > 0 ? issues.join("、") : "畫面不符合需求";
      const tipText =
        retakeTips.length > 0 ? ` 建議:${retakeTips.join("、")}` : "";
      feedback = `${issueText}。${tipText}`.trim();
    }

    return {
      pass,
      feedback,
      confidence:
        typeof parsed.confidence === "number" ? parsed.confidence : undefined,
      issues,
      retakeTips,
      contentMatch: contentMatch || undefined,
    };
  } catch {
    return { pass: false, feedback: "AI 回覆解析失敗,請再送出一次。" };
  }
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string" && v.trim() !== "")
    : [];
}
