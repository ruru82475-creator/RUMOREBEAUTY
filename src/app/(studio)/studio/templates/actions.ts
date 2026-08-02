"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// 選擇模板 → 建立剪輯專案(帶入模板的風格預設)→ 導向編輯頁
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
    .select("id, edit_preset")
    .eq("id", templateId)
    .eq("is_active", true)
    .maybeSingle();
  if (!template) {
    throw new Error("找不到這個樣板,請重新整理頁面再試。");
  }

  // 模板的風格預設直接成為專案的初始後製設定
  const preset = (template.edit_preset ?? {}) as Record<string, unknown>;
  const text = (key: string, fallback: string) =>
    typeof preset[key] === "string" ? (preset[key] as string) : fallback;

  const editConfig = {
    speed: typeof preset.speed === "number" ? preset.speed : 2,
    effect: text("effect", "none"),
    decoration: text("decoration", "none"),
    beauty: text("beauty", "off"),
    transition: text("transition", "fade"),
    caption: "",
    subtitle_style: text("subtitle_style", "classic-white"),
    caption_color: null,
    caption_font: null,
    music_hint: text("music_hint", ""),
    // 配樂氛圍:編輯頁會據此自動從音樂庫挑一首
    mood: text("mood", "chill"),
    music_key: null,
  };

  const { data: project, error } = await supabase
    .from("edit_projects")
    .insert({
      creator_id: user.id,
      template_id: templateId,
      status: "shooting",
      slot_uploads: [],
      edit_config: editConfig,
    })
    .select("id")
    .single();

  if (error || !project) {
    throw new Error("建立專案失敗,請稍後再試。");
  }

  redirect(`/studio/projects/${project.id}/shoot`);
}
