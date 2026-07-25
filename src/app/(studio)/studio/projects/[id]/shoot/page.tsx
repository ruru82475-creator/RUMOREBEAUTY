import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EditClient from "./shoot-client";

export const metadata = { title: "AI 自動後製 | GlowStudio" };

type EditConfig = {
  source_key?: string;
  speed?: number;
  caption?: string;
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

  return (
    <EditClient
      projectId={project.id}
      templateName={template?.name ?? "影片專案"}
      initialSourceKey={config.source_key ?? null}
      initialSpeed={config.speed === 2 || config.speed === 4 || config.speed === 8 ? config.speed : 1}
      initialCaption={config.caption ?? ""}
      initialMusicKey={config.music_key ?? null}
    />
  );
}
