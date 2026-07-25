import { Clapperboard, Clock, Layers, RectangleVertical } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { VideoTemplate } from "@/types/video";
import { createProjectFromTemplate } from "./actions";

export const metadata = { title: "選擇影片樣板 | GlowStudio" };

export default async function TemplatesPage() {
  const supabase = await createClient();
  const { data: templates } = await supabase
    .from("video_templates")
    .select(
      "id, name, description, preview_url, remotion_composition_id, aspect_ratio, total_duration_sec, slots, music_url, is_active"
    )
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  const list = (templates ?? []) as VideoTemplate[];

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="font-serif text-2xl">選擇影片樣板</h1>
      <p className="mt-2 text-sm text-foreground/50">
        挑一個樣板,AI 會一步步引導你拍攝需要的素材,拍完自動剪成成品。
      </p>

      {list.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-white/10 bg-white/5 px-5 py-12 text-center text-sm text-foreground/50">
          尚無可用樣板 — 請先到 SQL 一鍵複製頁執行「卡片 6:種子影片樣板」。
        </p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((template) => (
            <TemplateCard key={template.id} template={template} />
          ))}
        </div>
      )}
    </main>
  );
}

function TemplateCard({ template }: { template: VideoTemplate }) {
  const slotCount = Array.isArray(template.slots) ? template.slots.length : 0;

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5">
      {/* 預覽封面 */}
      <div className="relative aspect-video w-full">
        {template.preview_url ? (
          <video
            src={template.preview_url}
            muted
            playsInline
            preload="metadata"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand/25 via-background to-[#7a5ab7]/20">
            <Clapperboard className="size-8 text-foreground/30" />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h2 className="font-medium">{template.name}</h2>
        {template.description && (
          <p className="mt-1.5 text-sm leading-relaxed text-foreground/55">
            {template.description}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2 text-xs text-foreground/60">
          <span className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1">
            <Layers className="size-3.5 text-brand" />
            {slotCount} 個槽位
          </span>
          <span className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1">
            <Clock className="size-3.5 text-brand" />
            {template.total_duration_sec} 秒
          </span>
          <span className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1">
            <RectangleVertical className="size-3.5 text-brand" />
            {template.aspect_ratio}
          </span>
        </div>

        <form
          action={createProjectFromTemplate.bind(null, template.id)}
          className="mt-5"
        >
          <button
            type="submit"
            className="w-full rounded-xl bg-brand py-2.5 text-sm font-medium text-white transition hover:opacity-90"
          >
            使用此樣板
          </button>
        </form>
      </div>
    </article>
  );
}
