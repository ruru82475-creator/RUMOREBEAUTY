"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// 選擇樣板 → 建立剪輯專案 → 導向引導拍攝頁
export async function createProjectFromTemplate(templateId: string) {
  if (!z.uuid().safeParse(templateId).success) {
    throw new Error("樣板編號有誤");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/studio/templates");

  const { data: template } = await supabase
    .from("video_templates")
    .select("id")
    .eq("id", templateId)
    .eq("is_active", true)
    .maybeSingle();
  if (!template) {
    throw new Error("找不到這個樣板,請重新整理頁面再試。");
  }

  const { data: project, error } = await supabase
    .from("edit_projects")
    .insert({
      creator_id: user.id,
      template_id: templateId,
      status: "shooting",
      slot_uploads: [],
    })
    .select("id")
    .single();

  if (error || !project) {
    throw new Error("建立專案失敗,請稍後再試。");
  }

  redirect(`/studio/projects/${project.id}`);
}
