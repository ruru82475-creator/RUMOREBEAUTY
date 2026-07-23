"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Maximize, Pause, Play, Volume2, VolumeX, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Lightbox 需要的最小欄位(PortfolioItem 與首頁精選作品皆相容)
export type LightboxItem = {
  id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  video_url: string | null;
};

// 全螢幕 Lightbox:影片用自訂播放器(播放/進度條/靜音/全螢幕)
// view_count 於首次播放時 +1;sessionStorage 確保同 session 只計一次
export default function Lightbox({
  item,
  onClose,
}: {
  item: LightboxItem;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const countedRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  // ESC 關閉 + 鎖住背景捲動
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  function countViewOnce() {
    if (countedRef.current) return;
    countedRef.current = true;
    const key = `gs_viewed_${item.id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    createClient()
      .rpc("increment_view_count", { item_id: item.id })
      .then(() => {});
  }

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  }

  function seek(value: number) {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = value;
    setProgress(value);
  }

  function toggleFullscreen() {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      el.requestFullscreen().catch(() => {});
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={item.title}
      onClick={onClose}
    >
      <div
        ref={containerRef}
        className="relative w-full max-w-4xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="關閉"
          className="absolute -top-12 right-0 rounded-full p-2 text-white/70 transition hover:text-white"
        >
          <X className="size-6" />
        </button>

        {item.video_url ? (
          <div className="overflow-hidden rounded-xl bg-black">
            <video
              ref={videoRef}
              src={item.video_url}
              playsInline
              autoPlay
              className="max-h-[78vh] w-full"
              onClick={togglePlay}
              onPlay={() => {
                setPlaying(true);
                countViewOnce();
              }}
              onPause={() => setPlaying(false)}
              onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime)}
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
            />
            {/* 自訂控制列 */}
            <div className="flex items-center gap-3 bg-black/80 px-4 py-3">
              <button
                type="button"
                onClick={togglePlay}
                aria-label={playing ? "暫停" : "播放"}
                className="text-white/85 transition hover:text-white"
              >
                {playing ? (
                  <Pause className="size-5" />
                ) : (
                  <Play className="size-5" />
                )}
              </button>

              <span className="w-12 text-right text-xs tabular-nums text-white/60">
                {formatTime(progress)}
              </span>
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={progress}
                onChange={(e) => seek(Number(e.target.value))}
                aria-label="播放進度"
                className="h-1 flex-1 cursor-pointer accent-brand"
              />
              <span className="w-12 text-xs tabular-nums text-white/60">
                {formatTime(duration)}
              </span>

              <button
                type="button"
                onClick={() => {
                  const v = videoRef.current;
                  if (v) {
                    v.muted = !v.muted;
                    setMuted(v.muted);
                  }
                }}
                aria-label={muted ? "取消靜音" : "靜音"}
                className="text-white/85 transition hover:text-white"
              >
                {muted ? (
                  <VolumeX className="size-5" />
                ) : (
                  <Volume2 className="size-5" />
                )}
              </button>
              <button
                type="button"
                onClick={toggleFullscreen}
                aria-label="全螢幕"
                className="text-white/85 transition hover:text-white"
              >
                <Maximize className="size-5" />
              </button>
            </div>
          </div>
        ) : (
          item.cover_url && (
            <div className="relative max-h-[82vh] overflow-hidden rounded-xl">
              <Image
                src={item.cover_url}
                alt={item.title}
                width={1200}
                height={900}
                sizes="(min-width: 1024px) 896px, 92vw"
                className="h-auto max-h-[82vh] w-full object-contain"
              />
            </div>
          )
        )}

        <div className="mt-4 px-1">
          <h2 className="font-medium text-white">{item.title}</h2>
          {item.description && (
            <p className="mt-1 text-sm leading-relaxed text-white/60">
              {item.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTime(sec: number) {
  if (!Number.isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
