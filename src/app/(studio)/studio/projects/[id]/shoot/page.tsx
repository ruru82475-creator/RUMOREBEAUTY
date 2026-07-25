import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { SlotUpload, TemplateSlot } from "@/types/video";
import ShootClient from "./shoot-client";

export const metadata = { title: "AI 引導拍攝 | GlowStudio" };

export default async function ShootPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("edit_projects")
    .select("id, status, slot_uploads, template_id")
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();

  const { data: template } = await supabase
    .from("video_templates")
    .select("name, slots")
    .eq("id", project.template_id)
    .maybeSingle();
  if (!template) notFound();

  return (
    <ShootClient
      projectId={project.id}
      templateName={template.name}
      slots={template.slots as TemplateSlot[]}
      initialUploads={(project.slot_uploads ?? []) as SlotUpload[]}
    />
  );
}
