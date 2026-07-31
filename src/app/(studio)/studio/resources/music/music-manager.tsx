"use client";

import { useEffect, useRef, useState } from "react";
import {
  ExternalLink,
  Loader2,
  Music,
  Pause,
  Play,
  Trash2,
  Upload,
} from "lucide-react";
import {
  MUSIC_MOODS,
  formatDuration,
  type MusicMood,
  type MusicTrack,
} from "@/lib/resources/music";

const AUDIO_TYPES = ["audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/wav"];

export default function MusicManager() {
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsMigration, setNeedsMigration] = useState(false);
  const [uploadMood, setUploadMood] = useState<MusicMood>("elegant");
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(
    null
  );
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetch("/api/music/library")
      .then((r) => r.json())
      .then((d: { tracks?: MusicTrack[]; needsMigration?: boolean }) => {
        setTracks(d.tracks ?? []);
        setNeedsMigration(Boolean(d.needsMigration));
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    return () => {
      audioRef.current?.pause();
    };
  }, []);

  function togglePlay(track: MusicTrack) {
    if (playingId === track.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    audioRef.current?.pause();
    const audio = new Audio(track.file_url);
    audio.onended = () => setPlayingId(null);
    audio.play().catch(() => setError("試聽失敗,請確認檔案是否正常。"));
    audioRef.current = audio;
    setPlayingId(track.id);
  }

  async function handleFiles(files: FileList) {
    const list = Array.from(files).filter((f) => AUDIO_TYPES.includes(f.type));
    if (list.length === 0) {
      setError("請選擇 MP3、M4A 或 WAV 檔案。");
      return;
    }
    setError(null);
    setUploading({ done: 0, total: list.length });

    const added: MusicTrack[] = [];
    for (const [index, file] of list.entries()) {
      try {
        // 1. 取得上傳授權
        const presignRes = await fetch("/api/upload/presign", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            purpose: "music",
            contentType: file.type,
            size: file.size,
            name: file.name,
          }),
        });
        if (!presignRes.ok) throw new Error("取得上傳授權失敗");
        const { url, key } = (await presignRes.json()) as {
          url: string;
          key: string;
        };

        // 2. 直傳 R2
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", url);
          xhr.setRequestHeader("Content-Type", file.type);
          xhr.onload = () =>
            xhr.status >= 200 && xhr.status < 300
              ? resolve()
              : reject(new Error(`上傳失敗(HTTP ${xhr.status})`));
          xhr.onerror = () => reject(new Error("上傳失敗,請檢查網路"));
          xhr.send(file);
        });

        // 3. 登記到資料庫(標題取檔名、時長自動偵測)
        const createRes = await fetch("/api/music/library", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            key,
            title: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "),
            mood: uploadMood,
          }),
        });
        const created = (await createRes.json()) as {
          track?: MusicTrack;
          error?: string;
        };
        if (!createRes.ok || !created.track) {
          throw new Error(created.error ?? "登記失敗");
        }
        added.push(created.track);
      } catch (e) {
        setError(
          `「${file.name}」上傳失敗:${e instanceof Error ? e.message : "未知錯誤"}`
        );
      }
      setUploading({ done: index + 1, total: list.length });
    }

    setTracks((prev) => [...added, ...prev]);
    setUploading(null);
  }

  async function updateTrack(id: string, fields: Partial<MusicTrack>) {
    setTracks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...fields } : t))
    );
    await fetch("/api/music/library", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, ...fields }),
    }).catch(() => {});
  }

  async function removeTrack(track: MusicTrack) {
    if (!window.confirm(`確定要刪除「${track.title}」?`)) return;
    setTracks((prev) => prev.filter((t) => t.id !== track.id));
    await fetch(`/api/music/library?id=${track.id}`, { method: "DELETE" }).catch(
      () => {}
    );
  }

  const activeMood = MUSIC_MOODS.find((m) => m.id === uploadMood)!;

  return (
    <div className="mt-8">
      {needsMigration && (
        <p className="mb-6 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3.5 text-sm text-amber-200">
          音樂庫資料表尚未建立 — 請先到 SQL 一鍵複製頁執行「卡片 10:背景音樂庫」。
        </p>
      )}

      {/* 上傳區 */}
      <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <h2 className="flex items-center gap-2 font-medium">
          <Upload className="size-4 text-brand" />
          批次上傳
        </h2>
        <p className="mt-1.5 text-sm text-foreground/50">
          先選氛圍,再一次拖入多個檔案 — 這批全部會標記為同一種氛圍。
        </p>

        <div className="mt-4 grid grid-cols-5 gap-2">
          {MUSIC_MOODS.map((mood) => (
            <button
              key={mood.id}
              type="button"
              onClick={() => setUploadMood(mood.id)}
              className={`rounded-xl border py-2.5 text-sm transition ${
                uploadMood === mood.id
                  ? "border-brand bg-brand text-white"
                  : "border-white/15 text-foreground/60 hover:border-brand/60"
              }`}
            >
              {mood.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-foreground/45">
          {activeMood.description}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={Boolean(uploading)}
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-40"
          >
            {uploading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                上傳中 {uploading.done}/{uploading.total}
              </>
            ) : (
              <>
                <Upload className="size-4" />
                選擇檔案(可多選)
              </>
            )}
          </button>
          <a
            href={activeMood.pixabayUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-brand underline-offset-4 hover:underline"
          >
            <ExternalLink className="size-3.5" />
            到 Pixabay 找「{activeMood.label}」音樂
          </a>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </section>

      {error && (
        <p className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}

      {/* 曲目列表 */}
      {loading ? (
        <p className="mt-8 text-center text-sm text-foreground/40">載入中…</p>
      ) : tracks.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-white/10 bg-white/5 px-5 py-12 text-center text-sm text-foreground/50">
          音樂庫還是空的 — 用上面的按鈕加入第一批配樂吧。
        </p>
      ) : (
        <div className="mt-8 space-y-6">
          {MUSIC_MOODS.map((mood) => {
            const list = tracks.filter((t) => t.mood === mood.id);
            if (list.length === 0) return null;
            return (
              <section key={mood.id}>
                <h2 className="flex items-baseline gap-2 font-medium">
                  {mood.label}
                  <span className="text-xs text-foreground/40">
                    {list.length} 首
                  </span>
                </h2>
                <div className="mt-3 space-y-2">
                  {list.map((track) => (
                    <div
                      key={track.id}
                      className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                    >
                      <button
                        type="button"
                        onClick={() => togglePlay(track)}
                        aria-label={playingId === track.id ? "暫停" : "播放"}
                        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand text-white transition hover:opacity-90"
                      >
                        {playingId === track.id ? (
                          <Pause className="size-4" />
                        ) : (
                          <Play className="size-4" />
                        )}
                      </button>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{track.title}</p>
                        <p className="text-xs text-foreground/40">
                          {formatDuration(track.duration_sec)}
                          {track.artist ? `・${track.artist}` : ""}
                        </p>
                      </div>

                      <select
                        value={track.mood}
                        onChange={(e) =>
                          updateTrack(track.id, {
                            mood: e.target.value as MusicMood,
                          })
                        }
                        aria-label="氛圍分類"
                        className="shrink-0 rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-xs outline-none focus:border-brand"
                      >
                        {MUSIC_MOODS.map((m) => (
                          <option key={m.id} value={m.id} className="bg-[#1a161c]">
                            {m.label}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => removeTrack(track)}
                        aria-label={`刪除 ${track.title}`}
                        className="shrink-0 rounded-lg p-2 text-foreground/45 transition hover:bg-red-400/15 hover:text-red-300"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <p className="mt-8 flex items-start gap-2 text-xs leading-relaxed text-foreground/40">
        <Music className="mt-0.5 size-3.5 shrink-0" />
        Pixabay 音樂的授權允許商業使用且免標註出處,適合官網作品集與廣告。
        若想用真正的流行歌,請在編輯頁選「不加音樂」,到 IG / TikTok
        發布時使用平台內建的官方音樂庫。
      </p>
    </div>
  );
}
