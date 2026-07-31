"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Camera,
  FastForward,
  ImageIcon,
  Loader2,
  Music,
  RotateCcw,
  Shuffle,
  Sparkles,
  Type,
  Wand2,
} from "lucide-react";
import { BEAUTY_LEVELS, FILTER_PRESETS } from "@/lib/video/presets";
import { CAPTION_FONTS } from "@/lib/video/fonts";
import { CAPTION_STYLE_LABELS } from "@/lib/video/caption-styles";
import {
  MUSIC_MOODS,
  formatDuration,
  moodById,
  pickRandomTrack,
  type MusicTrack,
} from "@/lib/resources/music";

/** /api/media/music/xxx.mp3 → music/xxx.mp3 */
function keyFromUrl(fileUrl: string): string {
  const marker = "/api/media/";
  return fileUrl.startsWith(marker) ? fileUrl.slice(marker.length) : fileUrl;
}

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
  initialMood,
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
  initialMood: string;
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

  // 依模板氛圍自動配樂(可換一首,也可展開清單自己挑)
  const [mood, setMood] = useState(initialMood);
  const [library, setLibrary] = useState<MusicTrack[]>([]);
  const [showAllTracks, setShowAllTracks] = useState(false);

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

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const busy = phase !== "idle";
  const estimatedSec =
    sourceDuration != null ? Math.min(sourceDuration / speed, 120) : null;
  // 磨皮運算較重,開啟時成品長度的安全上限要更嚴格
  const lengthLimit = beauty === "off" ? 45 : beauty === "strong" ? 20 : 30;
  const tooLong = estimatedSec != null && estimatedSec > lengthLimit;
  // 目前選用的配樂(來自音樂庫時可顯示曲名與換一首)
  const currentTrack =
    library.find((t) => keyFromUrl(t.file_url) === musicKey) ?? null;

  // 載入音樂庫;若尚未指定配樂,依模板氛圍隨機挑一首
  useEffect(() => {
    let cancelled = false;
    fetch("/api/music/library")
      .then((r) => (r.ok ? r.json() : { tracks: [] }))
      .then((d: { tracks?: MusicTrack[] }) => {
        if (cancelled) return;
        const list = d.tracks ?? [];
        setLibrary(list);
        if (!initialMusicKey && list.length > 0) {
          const pick = pickRandomTrack(list, initialMood);
          if (pick) setMusicKey(keyFromUrl(pick.file_url));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [initialMood, initialMusicKey]);

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
    // AI 指定的氛圍 → 自動從音樂庫配一首
    if (advice.musicMood) {
      setMood(advice.musicMood);
      const pick = pickRandomTrack(library, advice.musicMood);
      if (pick) setMusicKey(keyFromUrl(pick.file_url));
    }
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
                  <Row label="配樂" value={moodById(advice.musicMood).label} />
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

        {/* 氛圍選擇 */}
        <div className="mt-3 grid grid-cols-5 gap-2">
          {MUSIC_MOODS.map((m) => (
            <button
              key={m.id}
              type="button"
              disabled={busy}
              onClick={() => {
                setMood(m.id);
                const pick = pickRandomTrack(library, m.id);
                setMusicKey(pick ? keyFromUrl(pick.file_url) : null);
              }}
              className={`rounded-xl border py-2 text-xs transition ${
                mood === m.id
                  ? "border-brand bg-brand text-white"
                  : "border-white/15 text-foreground/60 hover:border-brand/60"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-foreground/45">
          {moodById(mood).description}
        </p>

        {/* 目前配樂 */}
        {currentTrack ? (
          <div className="mt-4 rounded-2xl border border-brand/30 bg-brand/10 p-4">
            <p className="text-xs text-brand">目前配樂</p>
            <p className="mt-1 truncate font-medium">{currentTrack.title}</p>
            <p className="text-xs text-foreground/45">
              {formatDuration(currentTrack.duration_sec)}・
              {moodById(currentTrack.mood).label}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <audio
                src={currentTrack.file_url}
                controls
                preload="none"
                className="h-9 min-w-0 flex-1"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  const pick = pickRandomTrack(library, mood, currentTrack.id);
                  if (pick) setMusicKey(keyFromUrl(pick.file_url));
                }}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-brand px-3 py-2 text-xs text-brand transition hover:bg-brand hover:text-white"
              >
                <Shuffle className="size-3.5" />
                換一首
              </button>
            </div>
          </div>
        ) : musicKey ? (
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 p-4">
            <audio
              src={`/api/media/${musicKey}`}
              controls
              preload="none"
              className="h-9 min-w-0 flex-1"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => setMusicKey(null)}
              className="shrink-0 text-xs text-red-300 underline-offset-4 hover:underline"
            >
              移除
            </button>
          </div>
        ) : (
          <p className="mt-4 rounded-2xl border border-white/10 bg-background/40 px-4 py-4 text-sm text-foreground/55">
            {library.length === 0
              ? "音樂庫還是空的 — 到「背景音樂庫」加入配樂後,這裡就會自動幫你配好。"
              : "目前不加音樂(適合之後到 IG／TikTok 用平台官方音樂)。"}
          </p>
        )}

        {/* 自己挑 / 不加音樂 */}
        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
          {library.length > 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setShowAllTracks((v) => !v)}
              className="text-brand underline-offset-4 hover:underline"
            >
              {showAllTracks ? "收起清單" : "自己挑一首"}
            </button>
          )}
          {musicKey && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setMusicKey(null)}
              className="text-foreground/50 underline-offset-4 hover:text-foreground hover:underline"
            >
              不加音樂
            </button>
          )}
          <Link
            href="/studio/resources/music"
            className="ml-auto flex items-center gap-1 text-foreground/50 underline-offset-4 hover:text-brand hover:underline"
          >
            <Music className="size-3.5" />
            管理音樂庫
          </Link>
        </div>

        {showAllTracks && library.length > 0 && (
          <div className="mt-3 max-h-72 space-y-2 overflow-y-auto rounded-2xl border border-white/10 bg-background/40 p-3">
            {library.map((track) => {
              const key = keyFromUrl(track.file_url);
              return (
                <button
                  key={track.id}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setMusicKey(key);
                    setShowAllTracks(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                    musicKey === key
                      ? "border-brand bg-brand/10"
                      : "border-white/10 hover:border-brand/50"
                  }`}
                >
                  <span
                    className={`size-3.5 shrink-0 rounded-full border-2 ${
                      musicKey === key
                        ? "border-brand bg-brand"
                        : "border-white/30"
                    }`}
                  />
                  <span className="min-w-0 flex-1 truncate">{track.title}</span>
                  <span className="shrink-0 text-xs tabular-nums text-foreground/40">
                    {formatDuration(track.duration_sec)}
                  </span>
                  <span className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-foreground/50">
                    {moodById(track.mood).label}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <p className="mt-3 text-xs leading-relaxed text-foreground/40">
          音樂會取代原始聲音並在結尾淡出。想用真正的流行歌,請選「不加音樂」,
          到 IG／TikTok 發布時使用平台內建的官方音樂庫(那才是有授權的做法)。
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
