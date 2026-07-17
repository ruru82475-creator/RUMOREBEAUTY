import Link from "next/link";
import SiteHeader from "@/components/ui/site-header";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const { notice } = await searchParams;

  return (
    <div className="min-h-dvh">
      <SiteHeader />

      {notice === "studio_only" && (
        <div className="mx-auto mt-4 w-full max-w-5xl px-4">
          <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
            此區僅限站主使用
          </p>
        </div>
      )}

      <main className="mx-auto flex max-w-5xl flex-col items-center px-4 pb-16 pt-24 text-center sm:pt-32">
        <p className="mb-4 text-xs tracking-[0.35em] text-brand">GLOWSTUDIO</p>
        <h1 className="font-serif text-4xl leading-tight sm:text-5xl">
          讓每一位美容創作者
          <br />
          都有自己的舞台
        </h1>
        <p className="mt-6 max-w-md text-sm leading-relaxed text-foreground/60">
          個人品牌官網、客戶管理、AI 引導式影片剪輯與社群一鍵發布,
          全部在同一個地方完成。
        </p>
        <div className="mt-10">
          <Link
            href="/login"
            className="rounded-full bg-brand px-8 py-3 text-sm font-medium text-white transition hover:opacity-90"
          >
            開始使用
          </Link>
        </div>
      </main>
    </div>
  );
}
