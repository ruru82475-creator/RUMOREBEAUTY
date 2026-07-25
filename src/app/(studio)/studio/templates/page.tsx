import { Clock, FastForward, Sparkles, Wand2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { beautyById, presetById } from "@/lib/video/presets";
import { createProjectFromTemplate } from "./actions";

export const metadata = { title: "選擇風格模板 | GlowStudio" };

type TemplateRow = {
  id: string;
  name: string;
  description: string | null;
  total_duration_sec: number | null;
  edit_preset: {
    beauty?: string;
    effect?: string;
    speed?: number;
    transition?: string;
    music_hint?: string;
  } | null;
};

export default async function TemplatesPage() {
  const supabase = await createClient();
  const { data: templates } = await supabase
    .from("video_templates")
    .select("id, name, description, total_duration_sec, edit_preset")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  const list = (templates ?? []) as TemplateRow[];

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <p className="text-xs tracking-[0.3em] text-brand">VIDEO STUDIO</p>
      <h1 className="mt-1 font-serif text-2xl">選擇風格模板</h1>
      <p className="mt-2 text-sm text-foreground/50">
        挑一個風格,上傳一支影片就自動套用磨皮、調色、縮時、字幕與配樂 —
        套用後每一項都還能自己微調。
      </p>

      {list.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-white/10 bg-white/5 px-5 py-12 text-center text-sm text-foreground/50">
          尚無可用模板 — 請先到 SQL 一鍵複製頁執行「卡片 9:風格模板」。
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

function TemplateCard({ template }: { template: TemplateRow }) {
  const preset = template.edit_preset ?? {};
  const filter = presetById(preset.effect ?? "none");
  const beauty = beautyById(preset.beauty ?? "off");

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5">
      {/* 風格色調預覽:用 CSS 濾鏡呈現該預設的調性 */}
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        <div
          className="absolute inset-0 bg-[linear-gradient(135deg,#f6d9c9_0%,#e8b4a0_35%,#b76e79_70%,#5c3a4a_100%)]"
          style={{ filter: filter.css || undefined }}
        />
        <span className="absolute bottom-3 left-3 rounded-full bg-black/45 px-3 py-1 text-xs text-white backdrop-blur">
          {filter.label}
        </span>
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
            <Sparkles className="size-3.5 text-brand" />
            磨皮{beauty.label}
          </span>
          <span className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1">
            <FastForward className="size-3.5 text-brand" />
            {preset.speed && preset.speed > 1 ? `${preset.speed} 倍速` : "原速"}
          </span>
          {template.total_duration_sec && (
            <span className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1">
              <Clock className="size-3.5 text-brand" />
              約 {template.total_duration_sec} 秒
            </span>
          )}
        </div>

        <div className="flex-1" />

        <form
          action={createProjectFromTemplate.bind(null, template.id)}
          className="mt-5"
        >
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-sm font-medium text-white transition hover:opacity-90"
          >
            <Wand2 className="size-4" />
            使用這個風格
          </button>
        </form>
      </div>
    </article>
  );
}
