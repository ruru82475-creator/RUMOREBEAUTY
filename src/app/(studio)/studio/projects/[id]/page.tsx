import Link from "next/link";
import { notFound } from "next/navigation";
import { Wand2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "影片專案 | GlowStudio" };

const STATUS_LABEL: Record<string, string> = {
  shooting: "編輯中",
  validating: "處理中",
  ready: "待產生",
  rendering: "後製中",
  done: "已完成",
  failed: "失敗",
};

type EditConfig = {
  source_key?: string;
  speed?: number;
  caption?: string;
  music_key?: string | null;
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
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();

  const { data: template } = await supabase
    .from("video_templates")
    .select("name, description")
    .eq("id", project.template_id)
    .maybeSingle();

  const config = (project.edit_config ?? {}) as EditConfig;

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="mb-1 text-xs tracking-[0.3em] text-brand">
            VIDEO PROJECT
          </p>
          <h1 className="font-serif text-2xl">
            {template?.name ?? "影片專案"}
          </h1>
        </div>
        <span className="rounded-full border border-brand/50 px-4 py-1.5 text-sm text-brand">
          {STATUS_LABEL[project.status] ?? project.status}
        </span>
      </div>

      {/* 成品影片 */}
      {project.status === "done" && project.output_url && (
        <div className="mt-6 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-5">
          <p className="text-sm font-medium text-emerald-200">
            🎉 影片已完成!
          </p>
          <video
            src={project.output_url}
            controls
            playsInline
            preload="metadata"
            className="mx-auto mt-4 w-full max-w-[240px] rounded-xl border border-white/10"
          />
          <div className="mt-4 text-center">
            <a
              href={project.output_url}
              download
              className="inline-block rounded-full bg-brand px-6 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
            >
              下載影片
            </a>
          </div>
        </div>
      )}

      {project.status === "failed" && project.error_message && (
        <p className="mt-6 rounded-2xl border border-red-400/30 bg-red-400/10 px-5 py-4 text-sm text-red-200">
          後製失敗:{project.error_message} — 可回編輯頁重新產生。
        </p>
      )}

      {project.status === "rendering" && (
        <p className="mt-6 rounded-2xl border border-brand/30 bg-brand/10 px-5 py-4 text-sm text-foreground/70">
          影片後製中,請稍候再重新整理此頁。
        </p>
      )}

      {/* 目前設定 */}
      {config.source_key && (
        <dl className="mt-6 space-y-2 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-foreground/50">縮時速度</dt>
            <dd>{config.speed && config.speed > 1 ? `${config.speed} 倍` : "原速"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-foreground/50">美術字幕</dt>
            <dd className="min-w-0 truncate">{config.caption?.trim() || "未設定"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-foreground/50">背景音樂</dt>
            <dd>{config.music_key ? "已加入" : "無"}</dd>
          </div>
        </dl>
      )}

      <div className="mt-8 text-center">
        {project.status !== "rendering" && (
          <Link
            href={`/studio/projects/${project.id}/shoot`}
            className="inline-flex items-center gap-2.5 rounded-full bg-brand px-8 py-3.5 text-sm font-medium text-white transition hover:opacity-90"
          >
            <Wand2 className="size-4" />
            {project.status === "done" ? "調整設定重新產生" : "開始編輯影片"}
          </Link>
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
