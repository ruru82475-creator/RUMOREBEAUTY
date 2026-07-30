"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  FastForward,
  ImageIcon,
  Loader2,
  Music,
  RotateCcw,
  Search,
  Sparkles,
  Type,
  Wand2,
} from "lucide-react";
import { BEAUTY_LEVELS, FILTER_PRESETS } from "@/lib/video/presets";
import { CAPTION_FONTS } from "@/lib/video/fonts";
import { CAPTION_STYLE_LABELS } from "@/lib/video/caption-styles";

type Phase = "idle" | "uploading" | "rendering";
type Speed = 1 | 2 | 4 | 8;

// 伺服器偶爾會回傳非 JSON(例如逾時的錯誤頁),統一轉成看得懂的中文訊息
async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    if (res.status === 504 || res.status === 502) {
      throw new Error(
        "處理時間過長而中斷了。請把縮時倍速調高(例如 4 倍或 8 倍),讓成品短一點再試一次。"
      );
    }
    throw new Error(`伺服器忙碌中(代碼 ${res.status}),請稍後再試一次。`);
  }
}

const SPEED_OPTIONS: { value: Speed; label: string }[] = [
  { value: 1, label: "原速" },
  { value: 2, label: "2 倍" },
  { value: 4, label: "4 倍" },
  { value: 8, label: "8 倍" },
];

const EFFECTS = FILTER_PRESETS.map((p) => ({
  value: p.id,
  label: p.label,
  description: p.description,
  preview: p.css,
}));

const TRANSITIONS = [
  { value: "none", label: "無" },
  { value: "fade", label: "淡入淡出" },
  { value: "zoom", label: "緩慢推近" },
];

const CAPTION_STYLES = CAPTION_STYLE_LABELS.map((s) => ({
  value: s.id,
  label: s.label,
  fill: s.cssFill,
  shadow: s.cssShadow,
}));

type Track = { key: string; label: string };

type Recommendation = {
  templateName: string | null;
  filterPreset: string;
  beauty: string;
  subtitleStyle: string;
  subtitleFont: string;
  caption: string;
  musicMood: string;
  reason: string;
};

// 套用 AI 建議前的設定快照(供「復原」使用)
type Snapshot = {
  effect: string;
  beauty: string;
  captionStyle: string;
  captionFont: string;
  caption: string;
  query: string;
};
type FreeTrack = {
  id: string;
  title: string;
  creator: string;
  license: string;
  durationSec: number | null;
  url: string;
};

export default function EditClient({
  projectId,
  templateName,
  initialSourceKey,
  initialSpeed,
  initialCaption,
  initialCaptionStyle,
  initialCaptionFont,
  initialEffect,
  initialBeauty,
  initialTransition,
  initialMusicHint,
  initialMusicKey,
}: {
  projectId: string;
  templateName: string;
  initialSourceKey: string | null;
  initialSpeed: Speed;
  initialCaption: string;
  initialCaptionStyle: string;
  initialCaptionFont: string;
  initialEffect: string;
  initialBeauty: string;
  initialTransition: string;
  initialMusicHint: string;
  initialMusicKey: string | null;
}) {
  const router = useRouter();
  const [sourceKey, setSourceKey] = useState<string | null>(initialSourceKey);
  const [sourceDuration, setSourceDuration] = useState<number | null>(null);
  const [speed, setSpeed] = useState<Speed>(initialSpeed);
  const [effect, setEffect] = useState(initialEffect);
  const [beauty, setBeauty] = useState(initialBeauty);
  const [transition, setTransition] = useState(initialTransition);
  const [caption, setCaption] = useState(initialCaption);
  const [captionStyle, setCaptionStyle] = useState(initialCaptionStyle);
  const [captionFont, setCaptionFont] = useState(initialCaptionFont);
  const [musicKey, setMusicKey] = useState<string | null>(initialMusicKey);
  const [tracks, setTracks] = useState<Track[]>([]);

  // AI 風格建議(按鈕觸發;套用前的設定會留著供「復原」使用)
  const [advising, setAdvising] = useState(false);
  const [advice, setAdvice] = useState<Recommendation | null>(null);
  const [undoState, setUndoState] = useState<Snapshot | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [uploadKind, setUploadKind] = useState<"video" | "music">("video");
  const [error, setError] = useState<string | null>(null);

  // 免費音樂搜尋(模板會建議關鍵字)
  const [query, setQuery] = useState(initialMusicHint);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<FreeTrack[]>([]);
  const [importingId, setImportingId] = useState<string | null>(null);

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const musicRef = useRef<HTMLInputElement>(null);

  const busy = phase !== "idle";
  const estimatedSec =
    sourceDuration != null ? Math.min(sourceDuration / speed, 120) : null;
  // 磨皮運算較重,開啟時成品長度的安全上限要更嚴格
  const lengthLimit = beauty === "off" ? 45 : beauty === "strong" ? 20 : 30;
  const tooLong = estimatedSec != null && estimatedSec > lengthLimit;

  useEffect(() => {
    fetch("/api/music")
      .then((r) => (r.ok ? r.json() : { tracks: [] }))
      .then((d: { tracks?: Track[] }) => setTracks(d.tracks ?? []))
      .catch(() => {});
  }, []);

  async function uploadToR2(
    file: File,
    presignBody: Record<string, unknown>
  ): Promise<string> {
    const presignRes = await fetch("/api/upload/presign", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(presignBody),
    });
    const presign = await readJson<{
      url?: string;
      key?: string;
      error?: string;
    }>(presignRes);
    if (!presignRes.ok || !presign.url || !presign.key) {
      throw new Error(presign.error ?? "取得上傳授權失敗,請再試一次。");
    }
    const { url, key } = presign as { url: string; key: string };

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
      const label = file.name.replace(/\.[^.]+$/, "");
      setTracks((prev) => [{ key, label }, ...prev.filter((t) => t.key !== key)]);
      setMusicKey(key);
      setPhase("idle");
    } catch (e) {
      setPhase("idle");
      setError(e instanceof Error ? e.message : "音樂上傳失敗,請再試一次。");
    }
  }

  async function searchMusic() {
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/music/search?q=${encodeURIComponent(query || "relaxing beauty")}`
      );
      const data = await readJson<{ tracks?: FreeTrack[]; error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "搜尋失敗");
      setResults(data.tracks ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "音樂搜尋失敗");
    } finally {
      setSearching(false);
    }
  }

  async function importTrack(track: FreeTrack) {
    setImportingId(track.id);
    setError(null);
    try {
      const res = await fetch("/api/music/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: track.url, title: track.title }),
      });
      const data = await readJson<{
        key?: string;
        label?: string;
        error?: string;
      }>(res);
      if (!res.ok || !data.key) throw new Error(data.error ?? "加入失敗");
      setTracks((prev) => [
        { key: data.key!, label: data.label ?? track.title },
        ...prev.filter((t) => t.key !== data.key),
      ]);
      setMusicKey(data.key);
      setResults([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加入音樂庫失敗");
    } finally {
      setImportingId(null);
    }
  }

  // 讓 AI 看素材並提出整套風格建議(不自動套用)
  async function askAI() {
    if (!sourceKey || advising || busy) return;
    setError(null);
    setAdvising(true);
    try {
      const res = await fetch("/api/video/recommend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId, key: sourceKey }),
      });
      const data = await readJson<Recommendation & { error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "AI 分析失敗,請再試一次。");
      setAdvice(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI 分析失敗,請再試一次。");
    } finally {
      setAdvising(false);
    }
  }

  function applyAdvice() {
    if (!advice) return;
    // 先存下目前設定,套用後可一鍵復原
    setUndoState({
      effect,
      beauty,
      captionStyle,
      captionFont,
      caption,
      query,
    });
    setEffect(advice.filterPreset);
    setBeauty(advice.beauty);
    setCaptionStyle(advice.subtitleStyle);
    setCaptionFont(advice.subtitleFont);
    if (advice.caption) setCaption(advice.caption);
    if (advice.musicMood) setQuery(advice.musicMood);
    setAdvice(null);
  }

  function undoAdvice() {
    if (!undoState) return;
    setEffect(undoState.effect);
    setBeauty(undoState.beauty);
    setCaptionStyle(undoState.captionStyle);
    setCaptionFont(undoState.captionFont);
    setCaption(undoState.caption);
    setQuery(undoState.query);
    setUndoState(null);
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
          captionStyle,
          captionFont,
          effect,
          beauty,
          transition,
          musicKey: musicKey ?? undefined,
        }),
      });
      const result = await readJson<{ ok?: boolean; error?: string }>(res);
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
          {beauty !== "off" ? "磨皮、" : ""}
          {effect !== "none" ? "風格濾鏡、" : ""}
          {caption.trim() ? "美術字幕、" : ""}
          {musicKey ? "背景音樂、" : ""}直式構圖,
          約需 1~3 分鐘,請不要關閉此頁面。
        </p>
      </main>
    );
  }

  const activeCaptionStyle =
    CAPTION_STYLES.find((s) => s.value === captionStyle) ?? CAPTION_STYLES[0];
  const activeEffect = EFFECTS.find((e) => e.value === effect) ?? EFFECTS[0];

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <p className="text-xs tracking-[0.3em] text-brand">AI 自動後製</p>
      <h1 className="mt-1 font-serif text-2xl">{templateName}</h1>

      {/* 素材 */}
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
              style={{ filter: activeEffect.preview || undefined }}
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

      {/* 縮時 */}
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
          <p
            className={`mt-3 text-sm ${tooLong ? "text-amber-300" : "text-foreground/50"}`}
          >
            預估成品長度:約 {estimatedSec.toFixed(0)} 秒
            {tooLong && " — 成品較長,建議提高倍速以免後製逾時"}
          </p>
        )}
      </section>

      {/* AI 風格建議 */}
      {sourceKey && (
        <section className="mt-4 rounded-3xl border border-brand/30 bg-brand/[0.07] p-5">
          <h2 className="flex items-center gap-2 font-medium">
            <Sparkles className="size-4 text-brand" />
            AI 風格建議
          </h2>

          {advice ? (
            <div className="mt-3">
              <p className="text-sm leading-relaxed text-foreground/75">
                {advice.reason}
              </p>
              <dl className="mt-3 space-y-1.5 rounded-2xl bg-background/50 px-4 py-3 text-sm">
                {advice.templateName && (
                  <Row label="風格" value={advice.templateName} />
                )}
                <Row
                  label="色調"
                  value={
                    FILTER_PRESETS.find((f) => f.id === advice.filterPreset)
                      ?.label ?? advice.filterPreset
                  }
                />
                <Row
                  label="磨皮"
                  value={
                    BEAUTY_LEVELS.find((b) => b.id === advice.beauty)?.label ??
                    advice.beauty
                  }
                />
                <Row
                  label="字體"
                  value={
                    CAPTION_FONTS.find((f) => f.id === advice.subtitleFont)
                      ?.label ?? advice.subtitleFont
                  }
                />
                {advice.caption && (
                  <Row label="文案" value={`「${advice.caption}」`} />
                )}
                {advice.musicMood && (
                  <Row label="配樂" value={advice.musicMood} />
                )}
              </dl>
              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={applyAdvice}
                  className="flex-1 rounded-xl bg-brand py-3 text-sm font-medium text-white transition hover:opacity-90"
                >
                  套用建議
                </button>
                <button
                  type="button"
                  onClick={() => setAdvice(null)}
                  className="flex-1 rounded-xl border border-white/15 py-3 text-sm transition hover:bg-white/5"
                >
                  不用了
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="mt-1.5 text-sm text-foreground/55">
                讓 AI 看一下你的素材,推薦最適合的色調、磨皮、字體與文案 —
                套用與否都由你決定。
              </p>
              <div className="mt-3 flex gap-3">
                <button
                  type="button"
                  disabled={advising || busy}
                  onClick={askAI}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-40"
                >
                  {advising ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      分析中…
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-4" />
                      讓 AI 幫我挑風格
                    </>
                  )}
                </button>
                {undoState && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={undoAdvice}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-white/15 px-4 py-3 text-sm transition hover:bg-white/5"
                  >
                    <RotateCcw className="size-4" />
                    復原
                  </button>
                )}
              </div>
            </>
          )}
        </section>
      )}

      {/* 美顏磨皮 */}
      <section className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-5">
        <h2 className="flex items-center gap-2 font-medium">
          <Sparkles className="size-4 text-brand" />
          美顏磨皮
        </h2>
        <p className="mt-1.5 text-sm text-foreground/50">
          柔化膚質與細紋,同時保留睫毛、指甲彩繪等細節。
        </p>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {BEAUTY_LEVELS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              disabled={busy}
              onClick={() => setBeauty(opt.id)}
              className={`rounded-xl border py-2.5 text-sm transition ${
                beauty === opt.id
                  ? "border-brand bg-brand text-white"
                  : "border-white/15 text-foreground/60 hover:border-brand/60"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      {/* 畫面風格 */}
      <section className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-5">
        <h2 className="flex items-center gap-2 font-medium">
          <Wand2 className="size-4 text-brand" />
          畫面風格
        </h2>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {EFFECTS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={busy}
              onClick={() => setEffect(opt.value)}
              className={`overflow-hidden rounded-xl border text-center transition ${
                effect === opt.value
                  ? "border-brand ring-2 ring-brand/30"
                  : "border-white/15 hover:border-brand/60"
              }`}
            >
              <span
                className="block h-10 w-full bg-[linear-gradient(135deg,#f6d9c9_0%,#e8b4a0_40%,#b76e79_75%,#5c3a4a_100%)]"
                style={{ filter: opt.preview || undefined }}
              />
              <span
                className={`block px-1 py-1.5 text-[11px] leading-tight ${
                  effect === opt.value ? "text-brand" : "text-foreground/60"
                }`}
              >
                {opt.label}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-foreground/45">
          {activeEffect.description}
        </p>

        <h3 className="mt-5 text-sm text-foreground/70">開場 / 結尾轉場</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {TRANSITIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={busy}
              onClick={() => setTransition(opt.value)}
              className={`rounded-full border px-4 py-2 text-sm transition ${
                transition === opt.value
                  ? "border-brand bg-brand text-white"
                  : "border-white/15 text-foreground/60 hover:border-brand/60"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      {/* 美術字幕 */}
      <section className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-5">
        <h2 className="flex items-center gap-2 font-medium">
          <Type className="size-4 text-brand" />
          美術字幕
        </h2>
        <input
          type="text"
          value={caption}
          maxLength={60}
          disabled={busy}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="輸入想放在影片上的文字(可留空)"
          className="mt-3 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm outline-none transition placeholder:text-foreground/30 focus:border-brand"
        />
        {/* 字體 */}
        <div className="mt-3 grid grid-cols-4 gap-2">
          {CAPTION_FONTS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              disabled={busy}
              onClick={() => setCaptionFont(opt.id)}
              style={{ fontFamily: opt.cssStack }}
              className={`rounded-xl border py-2.5 text-sm transition ${
                captionFont === opt.id
                  ? "border-brand bg-brand text-white"
                  : "border-white/15 text-foreground/60 hover:border-brand/60"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* 配色 */}
        <div className="mt-2 flex flex-wrap gap-2">
          {CAPTION_STYLES.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={busy}
              onClick={() => setCaptionStyle(opt.value)}
              className={`rounded-full border px-3.5 py-1.5 text-xs transition ${
                captionStyle === opt.value
                  ? "border-brand bg-brand text-white"
                  : "border-white/15 text-foreground/60 hover:border-brand/60"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {caption.trim() && (
          <p
            className="mt-3 rounded-xl bg-black/50 px-4 py-4 text-center text-xl font-bold leading-snug"
            style={{
              color: activeCaptionStyle.fill,
              textShadow: activeCaptionStyle.shadow,
              fontFamily: CAPTION_FONTS.find((f) => f.id === captionFont)
                ?.cssStack,
            }}
          >
            {caption.trim()}
          </p>
        )}
        <p className="mt-2 text-xs text-foreground/40">
          自動斷行(最多三行),顯示在影片下方。預覽的字體外觀以成品為準。
        </p>
      </section>

      {/* 背景音樂 */}
      <section className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-5">
        <h2 className="flex items-center gap-2 font-medium">
          <Music className="size-4 text-brand" />
          背景音樂
        </h2>

        {/* 音樂庫 */}
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
                className="h-8 w-28 shrink-0"
              />
            </div>
          ))}
        </div>

        {/* 免費音樂搜尋(Openverse:CC0 / 公眾領域 / CC-BY) */}
        <div className="mt-4 rounded-2xl border border-white/10 bg-background/40 p-4">
          <p className="text-sm text-foreground/70">搜尋免費授權音樂</p>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={query}
              disabled={busy || searching}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  searchMusic();
                }
              }}
              placeholder="例:relaxing piano、upbeat"
              className="min-w-0 flex-1 rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-sm outline-none placeholder:text-foreground/30 focus:border-brand"
            />
            <button
              type="button"
              disabled={busy || searching}
              onClick={searchMusic}
              className="flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm text-white transition hover:opacity-90 disabled:opacity-40"
            >
              {searching ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
              搜尋
            </button>
          </div>

          {results.length > 0 && (
            <ul className="mt-3 space-y-2">
              {results.map((track) => (
                <li
                  key={track.id}
                  className="rounded-xl border border-white/10 bg-white/5 p-3"
                >
                  <p className="truncate text-sm">{track.title}</p>
                  <p className="mt-0.5 truncate text-xs text-foreground/45">
                    {track.creator}・{track.license}
                    {track.durationSec ? `・${track.durationSec} 秒` : ""}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <audio
                      src={track.url}
                      controls
                      preload="none"
                      className="h-8 min-w-0 flex-1"
                    />
                    <button
                      type="button"
                      disabled={importingId !== null}
                      onClick={() => importTrack(track)}
                      className="shrink-0 rounded-lg border border-brand px-3 py-1.5 text-xs text-brand transition hover:bg-brand hover:text-white disabled:opacity-40"
                    >
                      {importingId === track.id ? "加入中…" : "加入音樂庫"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() => musicRef.current?.click()}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 py-3 text-sm transition hover:border-brand/60 hover:bg-white/5 disabled:opacity-40"
        >
          <Music className="size-4" />
          或上傳自己的音樂
        </button>
        <p className="mt-2 text-xs text-foreground/40">
          音樂會取代原始聲音並在結尾淡出。搜尋結果來自 Openverse
          開放授權素材庫,加入音樂庫後每個專案都能重複選用。
        </p>
      </section>

      {error && (
        <p className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3.5 text-sm text-red-200">
          {error}
        </p>
      )}

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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-foreground/45">{label}</dt>
      <dd className="min-w-0 text-right">{value}</dd>
    </div>
  );
}
