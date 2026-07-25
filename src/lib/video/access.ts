import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// 影片處理 API 共用守衛:確認登入者是 creator,且 R2 key 屬於他
export async function requireCreatorForKey(
  key: string
): Promise<
  | { ok: true; supabase: SupabaseClient; user: User }
  | { ok: false; status: number; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, error: "請先登入" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "creator") {
    return { ok: false, status: 403, error: "僅站主可使用" };
  }

  if (key.startsWith(`portfolio/${user.id}/`)) {
    return { ok: true, supabase, user };
  }

  const projectMatch = key.match(/^projects\/([0-9a-f-]{36})\//);
  if (projectMatch) {
    const { data: project } = await supabase
      .from("edit_projects")
      .select("id")
      .eq("id", projectMatch[1])
      .eq("creator_id", user.id)
      .maybeSingle();
    if (project) return { ok: true, supabase, user };
  }

  return { ok: false, status: 403, error: "無權存取這個檔案" };
}
