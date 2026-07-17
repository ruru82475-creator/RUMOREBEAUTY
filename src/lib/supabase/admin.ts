import "server-only";
import { createClient } from "@supabase/supabase-js";

// Admin client:使用 service role key,繞過 RLS
// 僅限伺服器端信任情境使用(如:升級使用者為 creator、管理 video_templates)
// "server-only" 確保此模組被 import 進 Client Component 時直接建置失敗
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
