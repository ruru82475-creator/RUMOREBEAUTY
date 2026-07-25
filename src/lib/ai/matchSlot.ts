import { getAIProvider } from "./index";
import { tryConsumeAIQuota } from "./rateLimiter";
import type { TemplateSlot } from "@/types/video";

// AI 自動歸類:判斷一支影片最符合哪個(尚未填滿的)槽位
// AI 失敗、金鑰未設定或當日配額用盡時,退回「第一個空槽位」,流程不中斷
const SYSTEM_PROMPT = `你是影片素材分類員。你會收到一支影片的代表畫面,以及數個「鏡頭槽位」的說明。
請判斷這支影片最符合哪一個槽位。

回覆格式:只回傳 JSON,不要任何其他文字:
{"slot_id": "最符合的槽位 id"}

判斷不了時,選描述最接近的那個即可,一定要選一個。`;

export async function matchSlot(params: {
  frames: { base64: string; mimeType: string }[];
  candidates: TemplateSlot[];
}): Promise<{ slot: TemplateSlot; viaAI: boolean }> {
  const { frames, candidates } = params;
  if (candidates.length === 1) {
    return { slot: candidates[0], viaAI: false };
  }

  // 配額保護:超過每日上限就不呼叫 AI
  const quota = await tryConsumeAIQuota();
  if (!quota.allowed) {
    return { slot: candidates[0], viaAI: false };
  }

  try {
    const list = candidates
      .map(
        (s) =>
          `- slot_id「${s.slot_id}」:${s.name} — ${s.validation.required_content}`
      )
      .join("\n");

    const raw = await getAIProvider().analyzeFrames({
      images: frames,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: `可選的槽位如下:\n${list}\n\n請看畫面並回傳 JSON。`,
    });

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as { slot_id?: unknown };
      const found = candidates.find((s) => s.slot_id === parsed.slot_id);
      if (found) return { slot: found, viaAI: true };
    }
  } catch {
    // AI 不可用時走 fallback
  }
  return { slot: candidates[0], viaAI: false };
}
