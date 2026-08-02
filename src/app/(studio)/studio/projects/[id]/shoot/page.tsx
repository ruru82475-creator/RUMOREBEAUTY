import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EditClient from "./shoot-client";

export const metadata = { title: "AI 自動後製 | GlowStudio" };

type EditConfig = {
  source_key?: string;
  speed?: number;
  caption?: string;
  /** 12 組字幕風格 */
  subtitle_style?: string;
  /** 微調區的配色/字體覆蓋(null 表示沿用風格自帶的) */
  caption_color?: string | null;
  caption_font?: string | null;
  /** 舊資料留下的欄位:當時的 caption_style 存的是配色 id */
  caption_style?: string;
  effect?: string;
  decoration?: string;
  beauty?: string;
  transition?: string;
  music_hint?: string;
  mood?: string;
  music_key?: string | null;
};

export default async function ShootPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("edit_projects")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();

  const { data: template } = await supabase
    .from("video_templates")
    .select("name")
    .eq("id", project.template_id)
    .maybeSingle();

  const config = (project.edit_config ?? {}) as EditConfig;
  const speed =
    config.speed === 2 || config.speed === 4 || config.speed === 8
      ? config.speed
      : 1;

  return (
    <EditClient
      projectId={project.id}
      templateName={template?.name ?? "影片專案"}
      initialSourceKey={config.source_key ?? null}
      initialSpeed={speed}
      initialCaption={config.caption ?? ""}
      initialSubtitleStyle={config.subtitle_style ?? "classic-white"}
      initialCaptionColor={config.caption_color ?? config.caption_style ?? null}
      initialCaptionFont={config.caption_font ?? null}
      initialEffect={config.effect ?? "none"}
      initialDecoration={config.decoration ?? "none"}
      initialBeauty={config.beauty ?? "off"}
      initialTransition={config.transition ?? "fade"}
      initialMood={config.mood ?? "chill"}
      initialMusicKey={config.music_key ?? null}
    />
  );
}
