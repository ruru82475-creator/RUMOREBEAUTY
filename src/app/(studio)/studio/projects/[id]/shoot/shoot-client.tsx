"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  Check,
  Circle,
  ImageIcon,
  Loader2,
  Sparkles,
} from "lucide-react";
import type { SlotUpload, TemplateSlot } from "@/types/video";

type Phase = "idle" | "uploading" | "assigning" | "rendering";

// 自由上傳模式:傳一段影片 → AI 自動歸類到最合適的鏡頭槽位
// 不必照順序、不必拍滿全部,隨時可按「產生影片」直接後製
export default function ShootClient({
  projectId,
  templateName,
  slots,
  initialUploads,
}: {
  projectId: string;
  templateName: string;
  slots: TemplateSlot[];
  initialUploads: SlotUpload[];
}) {
  const router = useRouter();
  const [uploads, setUploads] = useState<SlotUpload[]>(initialUploads);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<{
    type: "ok" | "error";
    text: string;
  } | null>(null);

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const validatedIds = new Set(
    uploads.filter((u) => u.validated).map((u) => u.slot_id)
  );
  const filledCount = validatedIds.size;
  const busy = phase !== "idle";
  const allFilled = filledCount >= slots.length;

  async function handleFile(file: File) {
    if (busy) return;
    setMessage(null);

    if (!["video/mp4", "video/quicktime"].includes(file.type)) {
      setMessage({
        type: "error",
        text: "檔案格式不支援,請用手機直接錄影(MP4 / MOV)。",
      });
      return;
    }
    if (allFilled) {
      setMessage({
        type: "ok",
        text: "所有鏡頭都已有素材,直接按「產生影片」吧!",
      });
      return;
    }

    // 檔名用第一個空槽位命名(實際歸屬由 AI 判斷後登記)
    const targetSlot = slots.find((s) => !validatedIds.has(s.slot_id));
    if (!targetSlot) return;

    try {
      setPhase("uploading");
      setProgress(0);
      const presignRes = await fetch("/api/upload/presign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          purpose: "slot_upload",
          contentType: file.type,
          size: file.size,
          projectId,
          slotId: targetSlot.slot_id,
        }),
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

      setPhase("assigning");
      const assignRes = await fetch("/api/video/assign-slot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId, key }),
      });
      const result = (await assignRes.json()) as {
        slotId?: string;
        slotName?: string;
        durationSec?: number;
        filled?: number;
        total?: number;
        error?: string;
      };
      if (!assignRes.ok) {
        throw new Error(result.error ?? "素材歸類失敗,請再試一次。");
      }

      setUploads((prev) => [
        ...prev.filter((u) => u.slot_id !== result.slotId),
        {
          slot_id: result.slotId!,
          r2_key: key,
          duration: result.durationSec ?? null,
          validated: true,
          ai_feedback: `AI 已把這段歸類為「${result.slotName}」`,
        },
      ]);
      setMessage({
        type: "ok",
        text: `AI 已把這段歸類為「${result.slotName}」(${result.filled}/${result.total})`,
      });
      setPhase("idle");
    } catch (error) {
      setPhase("idle");
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "發生錯誤,請再試一次。",
      });
    }
  }

  async function handleRender() {
    if (busy || filledCount === 0) return;
    setMessage(null);
    setPhase("rendering");
    try {
      const res = await fetch("/api/video/render", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const result = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !result.ok) {
        throw new Error(result.error ?? "影片後製失敗,請再試一次。");
      }
      router.push(`/studio/projects/${projectId}`);
      router.refresh();
    } catch (error) {
      setPhase("idle");
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "後製失敗,請再試一次。",
      });
    }
  }

  if (phase === "rendering") {
    return (
      <main className="mx-auto flex min-h-[calc(100dvh-3.5rem)] max-w-md flex-col items-center justify-center px-4 text-center">
        <Loader2 className="size-12 animate-spin text-brand" />
        <h1 className="mt-6 font-serif text-2xl">影片後製中…</h1>
        <p className="mt-3 text-sm leading-relaxed text-foreground/60">
          正在把 {filledCount} 段素材裁切、調整為直式構圖並串接成片,
          約需 1~3 分鐘,請不要關閉此頁面。
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-3.5rem)] max-w-md flex-col px-4 py-6">
      {/* 頂部進度 */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-2.5">
          {slots.map((s, i) => {
            const done = validatedIds.has(s.slot_id);
            return done ? (
              <span
                key={s.slot_id}
                className="flex size-7 items-center justify-center rounded-full bg-emerald-400 text-background"
              >
                <Check className="size-4" strokeWidth={3} />
              </span>
            ) : (
              <span
                key={s.slot_id}
                className="flex size-7 items-center justify-center rounded-full bg-white/10 text-xs font-medium text-foreground/40"
              >
                {i + 1}
              </span>
            );
          })}
        </div>
        <p className="mt-3 text-sm text-foreground/55">
          {filledCount}/{slots.length} 段素材已就位
        </p>
        <p className="text-xs text-foreground/35">{templateName}</p>
      </div>

      {/* 上傳區 */}
      <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6">
        <h1 className="font-serif text-2xl">上傳拍攝素材</h1>
        <p className="mt-2 text-sm leading-relaxed text-foreground/55">
          一次傳一段,AI 會自動判斷它屬於哪個鏡頭。
          不必照順序、不必全部拍滿 — 傳好就能直接產生影片。
        </p>

        {phase === "uploading" && (
          <div className="mt-5">
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-brand transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-center text-sm tabular-nums text-foreground/60">
              上傳中 {progress}%
            </p>
          </div>
        )}

        {phase === "assigning" && (
          <div className="mt-5 flex items-center justify-center gap-3 rounded-xl border border-brand/30 bg-brand/10 px-4 py-4 text-sm">
            <Loader2 className="size-5 animate-spin text-brand" />
            AI 歸類素材中…
          </div>
        )}

        {message && (
          <p
            role="status"
            className={`mt-5 rounded-xl border px-4 py-3.5 text-sm leading-relaxed ${
              message.type === "ok"
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                : "border-red-400/30 bg-red-400/10 text-red-200"
            }`}
          >
            {message.text}
          </p>
        )}

        <div className="mt-5 space-y-3">
          <button
            type="button"
            disabled={busy || allFilled}
            onClick={() => cameraRef.current?.click()}
            className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-brand py-4 text-base font-medium text-white transition hover:opacity-90 disabled:opacity-40"
          >
            <Camera className="size-5" />
            拍攝並上傳
          </button>
          <button
            type="button"
            disabled={busy || allFilled}
            onClick={() => galleryRef.current?.click()}
            className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-white/15 py-3.5 text-sm transition hover:bg-white/5 disabled:opacity-40"
          >
            <ImageIcon className="size-4" />
            從相簿選擇
          </button>
        </div>
      </div>

      {/* 槽位清單 */}
      <div className="mt-5 space-y-2">
        {slots.map((s, i) => {
          const upload = uploads.find(
            (u) => u.slot_id === s.slot_id && u.validated
          );
          return (
            <div
              key={s.slot_id}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm"
            >
              {upload ? (
                <Check className="size-4 shrink-0 text-emerald-300" />
              ) : (
                <Circle className="size-4 shrink-0 text-foreground/20" />
              )}
              <span className={upload ? "" : "text-foreground/45"}>
                {i + 1}. {s.name}
                <span className="ml-1.5 text-xs text-foreground/35">
                  {s.duration_sec} 秒
                </span>
              </span>
              {upload?.duration != null && (
                <span className="ml-auto text-xs tabular-nums text-foreground/40">
                  已收到 {upload.duration}s
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* 產生影片 */}
      <button
        type="button"
        disabled={busy || filledCount === 0}
        onClick={handleRender}
        className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-brand to-[#a05a92] py-4 text-base font-medium text-white transition hover:opacity-90 disabled:opacity-40"
      >
        <Sparkles className="size-5" />
        產生影片({filledCount} 段素材)
      </button>
      {filledCount === 0 && (
        <p className="mt-2 text-center text-xs text-foreground/40">
          至少上傳一段素材就能產生影片
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
          if (file) handleFile(file);
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
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
    </main>
  );
}
