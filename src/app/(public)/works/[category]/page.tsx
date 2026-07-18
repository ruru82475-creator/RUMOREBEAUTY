import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/ui/site-header";
import WorksGallery from "@/components/ui/works-gallery";
import type { PortfolioItem, WorkCategory } from "@/types/portfolio";

const CATEGORIES: Record<
  WorkCategory,
  { title: string; eyebrow: string; description: string }
> = {
  beauty: {
    title: "美容作品集",
    eyebrow: "BEAUTY WORKS",
    description: "紋繡、美睫、美甲,每一件都為客人量身打造。",
  },
  "3dprint": {
    title: "3D 列印作品集",
    eyebrow: "3D PRINT WORKS",
    description: "客製飾品與紀念小物,把想法變成實體。",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const meta = CATEGORIES[category as WorkCategory];
  return { title: meta ? `${meta.title} | GlowStudio` : "作品集 | GlowStudio" };
}

export default async function WorksPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  if (category !== "beauty" && category !== "3dprint") notFound();
  const meta = CATEGORIES[category];

  const supabase = await createClient();
  const { data: items } = await supabase
    .from("portfolio_items")
    .select(
      "id, category, title, description, cover_url, video_url, media_type, tags, is_published, sort_order, view_count"
    )
    .eq("is_published", true)
    .eq("category", category)
    .order("sort_order", { ascending: true });

  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-12 md:py-16">
        <p className="mb-2 text-xs tracking-[0.35em] text-brand">
          {meta.eyebrow}
        </p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-serif text-3xl sm:text-4xl">{meta.title}</h1>
          <nav className="flex gap-2" aria-label="作品分類">
            {(Object.keys(CATEGORIES) as WorkCategory[]).map((key) => (
              <Link
                key={key}
                href={`/works/${key}`}
                className={`rounded-full border px-4 py-1.5 text-sm transition ${
                  key === category
                    ? "border-brand bg-brand text-white"
                    : "border-white/15 text-foreground/60 hover:border-brand/60 hover:text-foreground"
                }`}
              >
                {CATEGORIES[key].title}
              </Link>
            ))}
          </nav>
        </div>
        <p className="mt-3 text-sm text-foreground/55">{meta.description}</p>

        <div className="mt-10">
          <WorksGallery items={(items ?? []) as PortfolioItem[]} />
        </div>
      </main>
    </div>
  );
}
