import { createClient } from "@/lib/supabase/server";
import WorksManager from "./works-manager";
import type { PortfolioItem } from "@/types/portfolio";

export const metadata = { title: "作品集管理 | GlowStudio" };

export default async function StudioWorksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: items } = await supabase
    .from("portfolio_items")
    .select(
      "id, category, title, description, cover_url, video_url, media_type, tags, is_published, sort_order, view_count"
    )
    .eq("creator_id", user?.id ?? "")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-serif text-2xl">作品集管理</h1>
      <p className="mt-2 text-sm text-foreground/50">
        上傳、編輯、排序你的作品;打開發布開關後才會出現在對外頁面。
      </p>
      <div className="mt-8">
        <WorksManager initialItems={(items ?? []) as PortfolioItem[]} />
      </div>
    </main>
  );
}
