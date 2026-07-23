"use client";

import { useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";

type Kind = "image" | "video";

const ACCEPT: Record<Kind, string> = {
  image: "image/jpeg,image/png,image/webp",
  video: "video/mp4,video/quicktime",
};

const KIND_HINT: Record<Kind, string> = {
  image: "JPG / PNG / WebP,20MB 以內",
  video: "MP4 / MOV,500MB 以內",
};

// R2 直傳上傳元件:拖放或點選 → 取得預簽名授權 → XHR 直傳(真實進度條)
// 完成後回傳站內媒體路徑(/api/media/{r2_key})
export default function MediaUploader({
  label,
  kind,
  currentUrl,
  onUploaded,
  onClear,
}: {
  label: string;
  kind: Kind;
  currentUrl: string;
  onUploaded: (publicPath: string) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploading = progress !== null;

  async function handleFile(file: File) {
    setError(null);

    if (!ACCEPT[kind].split(",").includes(file.type)) {
      setError(`檔案格式不支援(${KIND_HINT[kind]})。`);
      return;
    }

    setProgress(0);
    try {
      // 1. 向後端要一次性上傳授權
      const presignRes = await fetch("/api/upload/presign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          purpose: "portfolio",
          contentType: file.type,
          size: file.size,
        }),
      });
      if (!presignRes.ok) {
        const body = await presignRes.json().catch(() => null);
        throw new Error(body?.error ?? "取得上傳授權失敗,請稍後再試。");
      }
      const { url, publicPath } = (await presignRes.json()) as {
        url: string;
        publicPath: string;
      };

      // 2. 直傳 R2(XHR 才拿得到上傳進度)
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
        xhr.onerror = () =>
          reject(new Error("上傳失敗,請檢查網路連線後再試。"));
        xhr.send(file);
      });

      onUploaded(publicPath);
    } catch (e) {
      setError(e instanceof Error ? e.message : "上傳失敗,請稍後再試。");
    } finally {
      setProgress(null);
    }
  }

  return (
    <div>
      <label className="mb-1.5 block text-sm text-foreground/70">{label}</label>

      {currentUrl && !uploading ? (
        <div className="flex items-center justify-between rounded-xl border border-white/15 bg-white/5 px-4 py-3">
          <span className="text-sm text-foreground/70">已上傳 ✓</span>
          <button
            type="button"
            onClick={onClear}
            className="flex items-center gap-1 text-xs text-red-300 underline-offset-4 hover:underline"
          >
            <X className="size-3.5" />
            移除
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!uploading) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (uploading) return;
            const file = e.dataTransfer.files?.[0];
            if (file) handleFile(file);
          }}
          onClick={() => !uploading && inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && !uploading) {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          className={`cursor-pointer rounded-xl border border-dashed px-4 py-6 text-center transition ${
            dragging
              ? "border-brand bg-brand/10"
              : "border-white/20 hover:border-brand/60 hover:bg-white/5"
          } ${uploading ? "pointer-events-none" : ""}`}
        >
          {uploading ? (
            <div>
              <Loader2 className="mx-auto size-5 animate-spin text-brand" />
              <div className="mx-auto mt-3 h-1.5 w-full max-w-52 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-brand transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-2 text-xs tabular-nums text-foreground/60">
                上傳中 {progress}%
              </p>
            </div>
          ) : (
            <div>
              <Upload className="mx-auto size-5 text-foreground/40" />
              <p className="mt-2 text-sm text-foreground/70">
                拖放檔案到這裡,或點擊選擇
              </p>
              <p className="mt-1 text-xs text-foreground/40">
                {KIND_HINT[kind]}
              </p>
            </div>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT[kind]}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />

      {error && <p className="mt-1.5 text-sm text-red-300">{error}</p>}
    </div>
  );
}
