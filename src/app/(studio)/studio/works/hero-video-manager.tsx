"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clapperboard } from "lucide-react";
import MediaUploader from "@/components/ui/media-uploader";
import { updateHeroVideo } from "./actions";

// 首頁 Hero 背景影片管理:單獨上傳,與作品集分開
export default function HeroVideoManager({
  currentUrl,
}: {
  currentUrl: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function save(url: string) {
    setError(null);
    const result = await updateHeroVideo(url);
    if (result.ok) {
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center gap-2.5">
        <Clapperboard className="size-5 text-brand" />
        <h2 className="font-medium">首頁背景影片</h2>
      </div>
      <p className="mt-1.5 text-sm text-foreground/50">
        這支影片會成為首頁最上方的全螢幕背景(靜音循環播放)。
        建議直式或方形、10~30 秒、畫面乾淨的作品片段;未設定時顯示動態漸層背景。
      </p>

      {currentUrl && (
        <video
          src={currentUrl}
          controls
          muted
          playsInline
          preload="metadata"
          className="mt-4 w-full max-w-xs rounded-xl border border-white/10"
        />
      )}

      <div className="mt-4">
        <MediaUploader
          label={currentUrl ? "更換影片" : "上傳影片"}
          kind="video"
          currentUrl={currentUrl}
          onUploaded={save}
          onClear={() => save("")}
        />
      </div>

      {error && (
        <p className="mt-3 rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}
    </section>
  );
}
