import { getAIProvider } from "./index";
import type { TemplateSlot } from "@/types/video";

// 槽位素材 AI 驗證(核心邏輯)
// 收到影片的三張代表幀,對照槽位需求判斷是否合格,回傳繁中回饋
export type SlotValidationResult = {
  pass: boolean;
  feedback: string;
};

const SHOT_TYPE_LABEL: Record<TemplateSlot["shot_type"], string> = {
  wide: "遠景(拍到完整環境或全身)",
  medium: "中景(半身或主體與部分環境)",
  "close-up": "特寫(主體佔滿畫面)",
};

// System prompt 獨立於此,之後要調整檢查標準只改這裡
const SYSTEM_PROMPT = `你是專業又親切的影片拍攝品質檢查員,服務對象是美容產業的創作者(非攝影專業)。
你會收到同一支影片依時間順序擷取的三張畫面,請對照拍攝需求檢查這支影片是否合格。

檢查原則(依重要性排序):
1. 「必要內容」是否確實出現在畫面中 — 這是最重要的判斷依據
2. 若需求標明要檢查亮度:畫面過暗、嚴重逆光、主體看不清楚都算不合格
3. 畫面嚴重模糊、鏡頭明顯歪斜、主體被切掉一大半,算不合格
4. 輕微的手震、構圖不完美「不要」因此打不合格 — 標準是「一般觀眾看起來沒問題」

回饋語氣:像朋友一樣鼓勵,具體、白話,不用攝影術語。

回覆格式:只回傳 JSON,不要有任何其他文字或 markdown 符號:
{"pass": true 或 false, "feedback": "一到兩句繁體中文(台灣用語)回饋"}

- 合格時:feedback 稱讚一句,點出拍得好的地方
- 不合格時:feedback 具體說哪裡不符合、怎麼重拍會更好(例如:再靠近一點、把燈打開、讓成品移到畫面中間)`;

export async function validateSlot(params: {
  frames: { base64: string; mimeType: string }[];
  slot: TemplateSlot;
  durationSec: number;
}): Promise<SlotValidationResult> {
  const { frames, slot, durationSec } = params;
  const ai = getAIProvider();

  const userPrompt = `拍攝需求如下:
- 鏡頭名稱:${slot.name}
- 拍攝指令:${slot.instruction}
- 景別要求:${SHOT_TYPE_LABEL[slot.shot_type] ?? slot.shot_type}
- 構圖提示:${slot.composition_hint}
- 必要內容:${slot.validation.required_content}
- 亮度檢查:${slot.validation.brightness_check ? "需要" : "不需要"}
- 影片實際長度:${durationSec.toFixed(1)} 秒(長度已預先檢查通過,不用再管)

以下三張圖依序是影片 10%、50%、90% 位置的畫面,請檢查並回傳 JSON。`;

  const raw = await ai.analyzeFrames({
    images: frames,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
  });

  // 容忍 AI 把 JSON 包在 code fence 或多餘文字裡
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { pass: false, feedback: "AI 回覆格式異常,請再送出一次。" };
  }
  try {
    const parsed = JSON.parse(jsonMatch[0]) as {
      pass?: unknown;
      feedback?: unknown;
    };
    return {
      pass: parsed.pass === true,
      feedback:
        typeof parsed.feedback === "string" && parsed.feedback.trim()
          ? parsed.feedback.trim()
          : parsed.pass === true
            ? "這段拍得很好!"
            : "畫面不太符合需求,請照拍攝指令再拍一次。",
    };
  } catch {
    return { pass: false, feedback: "AI 回覆解析失敗,請再送出一次。" };
  }
}
