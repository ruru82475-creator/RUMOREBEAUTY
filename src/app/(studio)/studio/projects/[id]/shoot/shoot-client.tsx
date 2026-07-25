"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  FastForward,
  ImageIcon,
  Loader2,
  Music,
  Sparkles,
  Type,
  X,
} from "lucide-react";

type Phase = "idle" | "uploading" | "rendering";

type Speed = 1 | 2 | 4 | 8;

const SPEED_OPTIONS: { value: Speed; label: string }[] = [
  { value: 1, label: "原速" },
  { value: 2, label: "2 倍" },
  { value: 4, label: "4 倍" },
  { value: 8, label: "8 倍" },
];

// AI 自動後製編輯器:上傳一支素材 → 縮時 + 美術字幕 + 背景音樂 → 產生成品
export default function EditClient({
  projectId,
  templateName,
  initialSourceKey,
  initialSpeed,
  initialCaption,
  initialMusicKey,
}: {
  projectId: string;
  templateName: string;
  initialSourceKey: string | null;
  initialSpeed: Speed;
  initialCaption: string;
  initialMusicKey: string | null;
}) {
  const router = useRouter();
  const [sourceKey, setSourceKey] = useState<string | null>(initialSourceKey);
  const [sourceDuration, setSourceDuration] = useState<number | null>(null);
  const [speed, setSpeed] = useState<Speed>(initialSpeed);
  const [caption, setCaption] = useState(initialCaption);
  const [musicKey, setMusicKey] = useState<string | null>(initialMusicKey);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [uploadKind, setUploadKind] = useState<"video" | "music">("video");
  const [tracks, setTracks] = useState<{ key: string; label: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  // 載入共用音樂庫
  useEffect(() => {
    fetch("/api/music")
      .then((r) => (r.ok ? r.json() : { tracks: [] }))
      .then((d: { tracks?: { key: string; label: string }[] }) =>
        setTracks(d.tracks ?? [])
      )
      .catch(() => {});
  }, []);

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const musicRef = useRef<HTMLInputElement>(null);

  const busy = phase !== "idle";
  const estimatedSec =
    sourceDuration != null ? Math.min(sourceDuration / speed, 120) : null;

  async function uploadToR2(
    file: File,
    presignBody: Record<string, unknown>
  ): Promise<string> {
    const presignRes = await fetch("/api/upload/presign", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(presignBody),
    });
    if (!presignRes.ok) {
      const body = await presignRes.json().catch(() => null);
      throw new Error(body?.error ?? "取得上傳授權失敗,請再試一次。");
    }
    const { url, key } = (await presignRes.json()) as {
      url: string;
      key: string;
    };

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url);
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.onload = () =>
        xhr.status >= 200 && xhr.status < 300
          ? resolve()
          : reject(new Error(`上傳失敗(HTTP ${xhr.status})`));
      xhr.onerror = () => reject(new Error("上傳失敗,請檢查網路連線。"));
      xhr.send(file);
    });

    return key;
  }

  async function handleVideoFile(file: File) {
    if (busy) return;
    setError(null);
    if (!["video/mp4", "video/quicktime"].includes(file.type)) {
      setError("影片格式不支援,請用手機直接錄影(MP4 / MOV)。");
      return;
    }
    try {
      setUploadKind("video");
      setPhase("uploading");
      setProgress(0);
      const key = await uploadToR2(file, {
        purpose: "slot_upload",
        contentType: file.type,
        size: file.size,
        projectId,
        slotId: "source",
      });
      setSourceKey(key);

      // 讀素材長度(顯示預估成品長度用;失敗不阻擋)
      try {
        const probeRes = await fetch("/api/video/probe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ key }),
        });
        if (probeRes.ok) {
          const info = (await probeRes.json()) as { durationSec?: number };
          if (info.durationSec) setSourceDuration(info.durationSec);
        }
      } catch {}
      setPhase("idle");
    } catch (e) {
      setPhase("idle");
      setError(e instanceof Error ? e.message : "上傳失敗,請再試一次。");
    }
  }

  async function handleMusicFile(file: File) {
    if (busy) return;
    setError(null);
    const okTypes = ["audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/wav"];
    if (!okTypes.includes(file.type)) {
      setError("音樂格式不支援(限 MP3、M4A、WAV)。");
      return;
    }
    try {
      setUploadKind("music");
      setPhase("uploading");
      setProgress(0);
      const key = await uploadToR2(file, {
        purpose: "music",
        contentType: file.type,
        size: file.size,
        name: file.name,
      });
      setMusicKey(key);
      // 新曲目加進音樂庫清單
      setTracks((prev) => [
        {
          key,
          label: file.name.replace(/\.[^.]+$/, ""),
        },
        ...prev.filter((t) => t.key !== key),
      ]);
      setPhase("idle");
    } catch (e) {
      setPhase("idle");
      setError(e instanceof Error ? e.message : "音樂上傳失敗,請再試一次。");
    }
  }

  async function handleRender() {
    if (busy || !sourceKey) return;
    setError(null);
    setPhase("rendering");
    try {
      const res = await fetch("/api/video/render", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId,
          sourceKey,
          speed,
          caption,
          musicKey: musicKey ?? undefined,
        }),
      });
      const result = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !result.ok) {
        throw new Error(result.error ?? "影片後製失敗,請再試一次。");
      }
      router.push(`/studio/projects/${projectId}`);
      router.refresh();
    } catch (e) {
      setPhase("idle");
      setError(e instanceof Error ? e.message : "後製失敗,請再試一次。");
    }
  }

  if (phase === "rendering") {
    return (
      <main className="mx-auto flex min-h-[calc(100dvh-3.5rem)] max-w-md flex-col items-center justify-center px-4 text-center">
        <Loader2 className="size-12 animate-spin text-brand" />
        <h1 className="mt-6 font-serif text-2xl">影片後製中…</h1>
        <p className="mt-3 text-sm leading-relaxed text-foreground/60">
          正在套用{speed > 1 ? `縮時 ${speed} 倍、` : ""}
          {caption.trim() ? "美術字幕、" : ""}
          {musicKey ? "背景音樂、" : ""}直式構圖,
          約需 1~3 分鐘,請不要關閉此頁面。
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <p className="text-xs tracking-[0.3em] text-brand">AI 自動後製</p>
      <h1 className="mt-1 font-serif text-2xl">{templateName}</h1>

      {/* 1. 素材 */}
      <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
        <h2 className="flex items-center gap-2 font-medium">
          <Camera className="size-4 text-brand" />
          素材影片
        </h2>

        {sourceKey ? (
          <div className="mt-4">
            <video
              src={`/api/media/${sourceKey}`}
              controls
              muted
              playsInline
              preload="metadata"
              className="mx-auto w-full max-w-[220px] rounded-xl border border-white/10"
            />
            <div className="mt-3 flex items-center justify-center gap-4 text-sm">
              {sourceDuration != null && (
                <span className="text-foreground/50">
                  素材 {sourceDuration.toFixed(0)} 秒
                </span>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => galleryRef.current?.click()}
                className="text-brand underline-offset-4 hover:underline"
              >
                更換素材
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => cameraRef.current?.click()}
              className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-brand py-4 text-base font-medium text-white transition hover:opacity-90 disabled:opacity-40"
            >
              <Camera className="size-5" />
              拍攝影片
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => galleryRef.current?.click()}
              className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-white/15 py-3.5 text-sm transition hover:bg-white/5 disabled:opacity-40"
            >
              <ImageIcon className="size-4" />
              從相簿選擇
            </button>
          </div>
        )}

        {phase === "uploading" && (
          <div className="mt-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-brand transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-center text-sm tabular-nums text-foreground/60">
              {uploadKind === "music" ? "音樂" : "影片"}上傳中 {progress}%
            </p>
          </div>
        )}
      </section>

      {/* 2. 縮時 */}
      <section className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-5">
        <h2 className="flex items-center gap-2 font-medium">
          <FastForward className="size-4 text-brand" />
          縮時效果
        </h2>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {SPEED_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={busy}
              onClick={() => setSpeed(opt.value)}
              className={`rounded-xl border py-2.5 text-sm transition ${
                speed === opt.value
                  ? "border-brand bg-brand text-white"
                  : "border-white/15 text-foreground/60 hover:border-brand/60"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {estimatedSec != null && (
          <p className="mt-3 text-sm text-foreground/50">
            預估成品長度:約 {estimatedSec.toFixed(0)} 秒
          </p>
        )}
      </section>

      {/* 3. 美術字幕 */}
      <section className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-5">
        <h2 className="flex items-center gap-2 font-medium">
          <Type className="size-4 text-brand" />
          美術字幕
        </h2>
        <input
          type="text"
          value={caption}
          maxLength={40}
          disabled={busy}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="輸入想放在影片上的文字(可留空)"
          className="mt-3 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm outline-none transition placeholder:text-foreground/30 focus:border-brand"
        />
        {caption.trim() && (
          <p className="mt-3 rounded-xl bg-black/40 px-4 py-3 text-center text-lg font-bold text-white">
            {caption.trim()}
          </p>
        )}
        <p className="mt-2 text-xs text-foreground/40">
          使用可愛圓體(粉圓體),白字黑邊,顯示在影片下方
        </p>
      </section>

      {/* 4. 背景音樂 */}
      <section className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-5">
        <h2 className="flex items-center gap-2 font-medium">
          <Music className="size-4 text-brand" />
          背景音樂
        </h2>
        {/* 音樂庫選單 */}
        <div className="mt-3 space-y-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => setMusicKey(null)}
            className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-sm transition ${
              musicKey === null
                ? "border-brand bg-brand/10"
                : "border-white/15 hover:border-brand/50"
            }`}
          >
            <span
              className={`size-4 shrink-0 rounded-full border-2 ${
                musicKey === null ? "border-brand bg-brand" : "border-white/30"
              }`}
            />
            不加音樂
          </button>

          {tracks.map((track) => (
            <div
              key={track.key}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition ${
                musicKey === track.key
                  ? "border-brand bg-brand/10"
                  : "border-white/15"
              }`}
            >
              <button
                type="button"
                disabled={busy}
                onClick={() => setMusicKey(track.key)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left text-sm"
              >
                <span
                  className={`size-4 shrink-0 rounded-full border-2 ${
                    musicKey === track.key
                      ? "border-brand bg-brand"
                      : "border-white/30"
                  }`}
                />
                <span className="truncate">{track.label}</span>
              </button>
              <audio
                src={`/api/media/${track.key}`}
                controls
                preload="none"
                className="h-8 w-32 shrink-0"
              />
            </div>
          ))}
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() => musicRef.current?.click()}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 py-3 text-sm transition hover:border-brand/60 hover:bg-white/5 disabled:opacity-40"
        >
          <Music className="size-4" />
          加入新音樂到音樂庫
        </button>
        <p className="mt-2 text-xs text-foreground/40">
          音樂會取代原始聲音並在結尾淡出。免費音樂可到 YouTube 音效庫
          (youtube.com/audiolibrary)下載無版權曲目,上傳一次之後每個專案都能選用。
        </p>
      </section>

      {error && (
        <p className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3.5 text-sm text-red-200">
          {error}
        </p>
      )}

      {/* 產生影片 */}
      <button
        type="button"
        disabled={busy || !sourceKey}
        onClick={handleRender}
        className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-brand to-[#a05a92] py-4 text-base font-medium text-white transition hover:opacity-90 disabled:opacity-40"
      >
        <Sparkles className="size-5" />
        產生影片
      </button>
      {!sourceKey && (
        <p className="mt-2 text-center text-xs text-foreground/40">
          先上傳一支素材影片就能產生
        </p>
      )}

      <input
        ref={cameraRef}
        type="file"
        accept="video/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleVideoFile(file);
          e.target.value = "";
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleVideoFile(file);
          e.target.value = "";
        }}
      />
      <input
        ref={musicRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleMusicFile(file);
          e.target.value = "";
        }}
      />
    </main>
  );
}
