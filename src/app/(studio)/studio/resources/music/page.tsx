import MusicManager from "./music-manager";

export const metadata = { title: "背景音樂庫 | GlowStudio" };

export default function MusicResourcePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-xs tracking-[0.3em] text-brand">RESOURCES</p>
      <h1 className="mt-1 font-serif text-2xl">背景音樂庫</h1>
      <p className="mt-2 text-sm leading-relaxed text-foreground/55">
        依氛圍分類管理你的配樂。做影片時系統會自動配上符合風格的音樂,
        你也隨時能換一首或自己指定。
      </p>
      <MusicManager />
    </main>
  );
}
