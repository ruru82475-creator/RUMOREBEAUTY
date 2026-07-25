import Link from "next/link";
import { notFound } from "next/navigation";
import { Camera, CheckCircle2, Circle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { SlotUpload, TemplateSlot, VideoTemplate } from "@/types/video";

export const metadata = { title: "剪輯專案 | GlowStudio" };

const STATUS_LABEL: Record<string, string> = {
  shooting: "拍攝中",
  validating: "AI 檢查中",
  ready: "待渲染",
  rendering: "渲染中",
  done: "已完成",
  failed: "失敗",
};

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("edit_projects")
    .select("id, status, slot_uploads, template_id, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();

  const { data: template } = await supabase
    .from("video_templates")
    .select("id, name, description, aspect_ratio, total_duration_sec, slots")
    .eq("id", project.template_id)
    .maybeSingle();
  if (!template) notFound();

  const slots = (template as VideoTemplate).slots as TemplateSlot[];
  const uploads = (project.slot_uploads ?? []) as SlotUpload[];
  const doneCount = uploads.filter((u) => u.validated).length;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="mb-1 text-xs tracking-[0.3em] text-brand">
            VIDEO PROJECT
          </p>
          <h1 className="font-serif text-2xl">{template.name}</h1>
        </div>
        <span className="rounded-full border border-brand/50 px-4 py-1.5 text-sm text-brand">
          {STATUS_LABEL[project.status] ?? project.status}
        </span>
      </div>

      <p className="mt-3 text-sm text-foreground/50">
        拍攝進度:{doneCount} / {slots.length} 個鏡頭完成
      </p>

      <div className="mt-8 space-y-3">
        {slots.map((slot, i) => {
          const upload = uploads.find((u) => u.slot_id === slot.slot_id);
          const isDone = Boolean(upload?.validated);
          return (
            <div
              key={slot.slot_id}
              className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/5 p-5"
            >
              {isDone ? (
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-300" />
              ) : (
                <Circle className="mt-0.5 size-5 shrink-0 text-foreground/25" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {i + 1}. {slot.name}
                  <span className="ml-2 text-xs text-foreground/40">
                    {slot.duration_sec} 秒・
                    {slot.shot_type === "wide"
                      ? "遠景"
                      : slot.shot_type === "medium"
                        ? "中景"
                        : "特寫"}
                  </span>
                </p>
                <p className="mt-1 text-sm leading-relaxed text-foreground/55">
                  {slot.instruction}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 text-center">
        {project.status === "shooting" && (
          <Link
            href={`/studio/projects/${project.id}/shoot`}
            className="inline-flex items-center gap-2.5 rounded-full bg-brand px-8 py-3.5 text-sm font-medium text-white transition hover:opacity-90"
          >
            <Camera className="size-4" />
            {doneCount > 0 ? "繼續 AI 引導拍攝" : "開始 AI 引導拍攝"}
          </Link>
        )}
        {project.status === "ready" && (
          <p className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-5 py-5 text-sm text-emerald-200">
            素材已全部通過 AI 檢查 🎉 等待渲染 — 自動剪輯功能將在下一階段開通。
          </p>
        )}
        <p className="mt-4">
          <Link
            href="/studio/templates"
            className="text-sm text-foreground/50 underline-offset-4 hover:text-brand hover:underline"
          >
            ← 返回樣板列表
          </Link>
        </p>
      </div>
    </main>
  );
}
