import { createAdminClient } from "@/lib/supabase/admin";

// Gemini 免費配額保護(每日約 1,500 次)
// - 每次 AI 呼叫前先計數
// - 達 1,450 次/天:停止呼叫 AI,流程自動放行(標記 skipped)
// - 1,400 次起算警告區間(記錄於回傳值,可供之後顯示於後台)
// - 計數以 UTC 日期為 key,午夜自動重置
const WARN_AT = 1400;
const HARD_LIMIT = 1450;

export type QuotaCheck = {
  allowed: boolean;
  warning: boolean;
  count: number; // -1 = 計數表尚未建立(不阻擋)
};

export async function tryConsumeAIQuota(): Promise<QuotaCheck> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("increment_ai_usage");
    if (error || typeof data !== "number") {
      // 表或函式尚未建立(migration 未跑):不阻擋,照常呼叫 AI
      return { allowed: true, warning: false, count: -1 };
    }
    return {
      allowed: data <= HARD_LIMIT,
      warning: data >= WARN_AT,
      count: data,
    };
  } catch {
    return { allowed: true, warning: false, count: -1 };
  }
}
