"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Camera,
  Check,
  CheckCircle2,
  Clock,
  ImageIcon,
  Loader2,
  PartyPopper,
  RotateCcw,
} from "lucide-react";
import type { SlotUpload, TemplateSlot } from "@/types/video";

type Phase = "idle" | "uploading" | "validating" | "failed" | "passed" | "alldone";

// AI 引導式拍攝:逐槽位 拍攝 → R2 直傳 → AI 驗證 → 下一鏡頭
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

  const firstIncomplete = slots.findIndex(
    (s) => !initialUploads.some((u) => u.slot_id === s.slot_id && u.validated)
  );
  const [activeIndex, setActiveIndex] = useState(
    firstIncomplete === -1 ? 0 : firstIncomplete
  );
  const [phase, setPhase] = useState<Phase>(
    firstIncomplete === -1 ? "alldone" : "idle"
  );
  const [progress, setProgress] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const validatedIds = new Set(
    uploads.filter((u) => u.validated).map((u) => u.slot_id)
  );
  const slot = slots[activeIndex];

  async function handleFile(file: File) {
    if (!slot || phase === "uploading" || phase === "validating") return;
    setFeedback(null);

    if (!["video/mp4", "video/quicktime"].includes(file.type)) {
      setPhase("failed");
      setFeedback("檔案格式不支援,請用手機直接錄影(MP4 / MOV)。");
      return;
    }

    try {
      // 1. 取得上傳授權
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
          slotId: slot.slot_id,
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

      // 2. 直傳 R2
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

      // 3. AI 驗證
      setPhase("validating");
      const validateRes = await fetch("/api/video/validate-slot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId, slotId: slot.slot_id, key }),
      });
      const result = (await validateRes.json()) as {
        pass?: boolean;
        feedback?: string;
        durationSec?: number;
        error?: string;
      };
      if (!validateRes.ok) {
        throw new Error(result.error ?? "驗證失敗,請再試一次。");
      }

      setUploads((prev) => [
        ...prev.filter((u) => u.slot_id !== slot.slot_id),
        {
          slot_id: slot.slot_id,
          r2_key: key,
          duration: result.durationSec ?? null,
          validated: Boolean(result.pass),
          ai_feedback: result.feedback ?? null,
        },
      ]);
      setFeedback(result.feedback ?? null);
      setPhase(result.pass ? "passed" : "failed");
    } catch (error) {
      setPhase("failed");
      setFeedback(
        error instanceof Error ? error.message : "發生錯誤,請再試一次。"
      );
    }
  }

  function goNext() {
    const doneIds = new Set(
      uploads.filter((u) => u.validated).map((u) => u.slot_id)
    );
    const next = slots.findIndex((s) => !doneIds.has(s.slot_id));
    setFeedback(null);
    setProgress(0);
    if (next === -1) {
      setPhase("alldone");
      router.refresh();
    } else {
      setActiveIndex(next);
      setPhase("idle");
    }
  }

  if (phase === "alldone") {
    return (
      <main className="mx-auto flex min-h-[calc(100dvh-3.5rem)] max-w-md flex-col items-center justify-center px-4 text-center">
        <PartyPopper className="size-12 text-brand" />
        <h1 className="mt-6 font-serif text-2xl">素材全部合格!</h1>
        <p className="mt-3 text-sm leading-relaxed text-foreground/60">
          {slots.length} 個鏡頭都通過 AI 檢查,專案已進入「待渲染」狀態。
          自動剪輯功能將在下一階段開通。
        </p>
        <Link
          href={`/studio/projects/${projectId}`}
          className="mt-8 rounded-full bg-brand px-8 py-3 text-sm font-medium text-white transition hover:opacity-90"
        >
          回專案頁
        </Link>
      </main>
    );
  }

  const busy = phase === "uploading" || phase === "validating";

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-3.5rem)] max-w-md flex-col px-4 py-6">
      {/* 頂部進度 */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-2.5">
          {slots.map((s, i) => {
            const done = validatedIds.has(s.slot_id);
            const current = i === activeIndex;
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
                className={`flex size-7 items-center justify-center rounded-full text-xs font-medium ${
                  current
                    ? "bg-brand text-white ring-4 ring-brand/25 motion-safe:animate-pulse"
                    : "bg-white/10 text-foreground/40"
                }`}
              >
                {i + 1}
              </span>
            );
          })}
        </div>
        <p className="mt-3 text-sm text-foreground/55">
          第 {activeIndex + 1}/{slots.length} 步 — {slot.name}
        </p>
        <p className="text-xs text-foreground/35">{templateName}</p>
      </div>

      {/* 主卡片 */}
      <div className="mt-6 flex flex-1 flex-col rounded-3xl border border-white/10 bg-white/5 p-6">
        <h1 className="font-serif text-3xl">{slot.name}</h1>
        <p className="mt-4 text-base leading-relaxed text-foreground/85">
          {slot.instruction}
        </p>

        <div className="mt-6 flex items-center gap-5">
          <ShotFrame type={slot.shot_type} />
          <div className="min-w-0 flex-1 space-y-3 text-sm">
            <p className="flex items-center gap-2 text-foreground/70">
              <Clock className="size-4 shrink-0 text-brand" />
              建議拍攝至少 {slot.validation.min_duration} 秒
            </p>
            <p className="leading-relaxed text-foreground/55">
              💡 {slot.composition_hint}
            </p>
          </div>
        </div>

        <div className="flex-1" />

        {/* 狀態回饋 */}
        {phase === "uploading" && (
          <div className="mb-4">
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

        {phase === "validating" && (
          <div className="mb-4 flex items-center justify-center gap-3 rounded-xl border border-brand/30 bg-brand/10 px-4 py-4 text-sm">
            <Loader2 className="size-5 animate-spin text-brand" />
            處理影片中,馬上好…
          </div>
        )}

        {phase === "failed" && feedback && (
          <div className="mb-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-4 text-sm leading-relaxed text-red-200">
            {feedback}
          </div>
        )}

        {phase === "passed" && feedback && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-4 text-sm leading-relaxed text-emerald-200">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
            {feedback}
          </div>
        )}

        {/* 操作按鈕 */}
        {phase === "passed" ? (
          <button
            type="button"
            onClick={goNext}
            className="w-full rounded-2xl bg-brand py-4 text-base font-medium text-white transition hover:opacity-90"
          >
            {validatedIds.size >= slots.length ? "完成拍攝 🎉" : "下一個鏡頭 →"}
          </button>
        ) : (
          <div className="space-y-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => cameraRef.current?.click()}
              className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-brand py-4 text-base font-medium text-white transition hover:opacity-90 disabled:opacity-40"
            >
              {phase === "failed" ? (
                <RotateCcw className="size-5" />
              ) : (
                <Camera className="size-5" />
              )}
              {phase === "failed" ? "重新拍攝" : "上傳這段影片"}
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
      </div>

      {/* 隱藏的檔案輸入:capture 直接開相機;另一個走相簿 */}
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

// 景別線框示意圖(9:16 直式取景框)
function ShotFrame({ type }: { type: TemplateSlot["shot_type"] }) {
  return (
    <svg
      viewBox="0 0 90 160"
      className="h-36 w-auto shrink-0"
      fill="none"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden
    >
      <rect
        x="3"
        y="3"
        width="84"
        height="154"
        rx="10"
        stroke="currentColor"
        className="text-white/20"
      />
      {type === "wide" && (
        <g stroke="currentColor" className="text-brand">
          <circle cx="45" cy="58" r="8" />
          <line x1="45" y1="66" x2="45" y2="98" />
          <line x1="45" y1="75" x2="32" y2="89" />
          <line x1="45" y1="75" x2="58" y2="89" />
          <line x1="45" y1="98" x2="34" y2="122" />
          <line x1="45" y1="98" x2="56" y2="122" />
        </g>
      )}
      {type === "medium" && (
        <g stroke="currentColor" className="text-brand">
          <circle cx="45" cy="56" r="15" />
          <path d="M18 132 v-18 a27 27 0 0 1 54 0 v18" />
        </g>
      )}
      {type === "close-up" && (
        <g stroke="currentColor" className="text-brand">
          <circle cx="42" cy="70" r="25" />
          <line x1="60" y1="88" x2="76" y2="106" strokeWidth="5" />
        </g>
      )}
    </svg>
  );
}
