"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Reorder } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import MediaUploader from "@/components/ui/media-uploader";
import type { PortfolioItem } from "@/types/portfolio";
import {
  deleteWork,
  reorderWorks,
  saveWork,
  togglePublish,
} from "./actions";

const formSchema = z.object({
  title: z.string().min(1, "請輸入標題").max(200, "標題過長"),
  category: z.enum(["beauty", "3dprint"]),
  description: z.string().max(2000, "描述過長"),
  tags: z.string().max(500, "標籤過長"),
  cover_url: z.string(),
  video_url: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

export default function WorksManager({
  initialItems,
}: {
  initialItems: PortfolioItem[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [editing, setEditing] = useState<PortfolioItem | "new" | null>(null);
  const [orderDirty, setOrderDirty] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // server action 完成後 router.refresh() 會更新 initialItems,同步回本地列表
  useEffect(() => {
    setItems(initialItems);
    setOrderDirty(false);
  }, [initialItems]);

  async function handleSaveOrder() {
    setSavingOrder(true);
    const result = await reorderWorks(items.map((i) => i.id));
    setSavingOrder(false);
    if (result.ok) {
      setOrderDirty(false);
      setMessage("排序已儲存。");
      router.refresh();
    } else {
      setMessage(result.error);
    }
  }

  async function handleTogglePublish(item: PortfolioItem) {
    const next = !item.is_published;
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, is_published: next } : i))
    );
    const result = await togglePublish(item.id, next);
    if (!result.ok) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, is_published: !next } : i
        )
      );
      setMessage(result.error);
    }
  }

  async function handleDelete(item: PortfolioItem) {
    if (!window.confirm(`確定要刪除「${item.title}」?此動作無法復原。`)) {
      return;
    }
    const result = await deleteWork(item.id);
    if (result.ok) {
      setMessage("已刪除。");
      router.refresh();
    } else {
      setMessage(result.error);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-foreground/50">
          拖曳左側把手可調整順序;順序會同步到對外頁面。
        </p>
        <div className="flex gap-2">
          {orderDirty && (
            <button
              type="button"
              onClick={handleSaveOrder}
              disabled={savingOrder}
              className="rounded-full border border-brand px-4 py-2 text-sm text-brand transition hover:bg-brand hover:text-white disabled:opacity-50"
            >
              {savingOrder ? "儲存中…" : "儲存排序"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          >
            <Plus className="size-4" />
            新增作品
          </button>
        </div>
      </div>

      {message && (
        <p
          role="status"
          className="mt-4 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-foreground/70"
        >
          {message}
        </p>
      )}

      {items.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-white/10 bg-white/5 px-5 py-12 text-center text-sm text-foreground/50">
          還沒有作品,按右上角「新增作品」開始建立。
        </p>
      ) : (
        <Reorder.Group
          axis="y"
          values={items}
          onReorder={(next) => {
            setItems(next);
            setOrderDirty(true);
          }}
          className="mt-6 space-y-3"
        >
          {items.map((item) => (
            <Reorder.Item
              key={item.id}
              value={item}
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3"
            >
              <span className="cursor-grab touch-none text-foreground/35 active:cursor-grabbing">
                <GripVertical className="size-5" />
              </span>

              <Thumb item={item} />

              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{item.title}</p>
                <p className="mt-0.5 flex items-center gap-2 text-xs text-foreground/45">
                  <span>
                    {item.category === "3dprint" ? "3D 列印" : "美容"}
                  </span>
                  {item.view_count > 0 && (
                    <span className="flex items-center gap-1">
                      <Eye className="size-3" />
                      {item.view_count}
                    </span>
                  )}
                </p>
              </div>

              {/* 發布開關 */}
              <button
                type="button"
                role="switch"
                aria-checked={item.is_published}
                aria-label={`${item.title} 發布狀態`}
                onClick={() => handleTogglePublish(item)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                  item.is_published ? "bg-brand" : "bg-white/15"
                }`}
              >
                <span
                  className={`absolute top-0.5 size-5 rounded-full bg-white transition-all ${
                    item.is_published ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </button>

              <button
                type="button"
                onClick={() => setEditing(item)}
                aria-label={`編輯 ${item.title}`}
                className="rounded-lg p-2 text-foreground/50 transition hover:bg-white/10 hover:text-foreground"
              >
                <Pencil className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(item)}
                aria-label={`刪除 ${item.title}`}
                className="rounded-lg p-2 text-foreground/50 transition hover:bg-red-400/15 hover:text-red-300"
              >
                <Trash2 className="size-4" />
              </button>
            </Reorder.Item>
          ))}
        </Reorder.Group>
      )}

      {editing && (
        <WorkForm
          item={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setMessage("已儲存。");
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function Thumb({ item }: { item: PortfolioItem }) {
  if (item.cover_url) {
    return (
      <span className="relative block size-14 shrink-0 overflow-hidden rounded-lg">
        <Image
          src={item.cover_url}
          alt=""
          fill
          sizes="56px"
          className="object-cover"
        />
      </span>
    );
  }
  if (item.video_url) {
    return (
      <video
        src={item.video_url}
        preload="metadata"
        muted
        playsInline
        className="size-14 shrink-0 rounded-lg object-cover"
      />
    );
  }
  return (
    <span className="block size-14 shrink-0 rounded-lg bg-gradient-to-br from-brand/25 to-[#7a5ab7]/20" />
  );
}

// ---- 新增/編輯表單(全螢幕面板) ----
function WorkForm({
  item,
  onClose,
  onSaved,
}: {
  item: PortfolioItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: item?.title ?? "",
      category: item?.category ?? "beauty",
      description: item?.description ?? "",
      tags: item?.tags?.join(", ") ?? "",
      cover_url: item?.cover_url ?? "",
      video_url: item?.video_url ?? "",
    },
  });

  const coverUrl = watch("cover_url");
  const videoUrl = watch("video_url");

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const result = await saveWork({ ...values, id: item?.id });
    if (result.ok) onSaved();
    else setServerError(result.error);
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={item ? "編輯作品" : "新增作品"}
    >
      <div className="mx-auto my-6 w-full max-w-lg rounded-2xl border border-white/10 bg-[#1a161c] p-6">
        <h2 className="font-serif text-xl">
          {item ? "編輯作品" : "新增作品"}
        </h2>

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="mt-6 space-y-4"
        >
          <div>
            <label className="mb-1.5 block text-sm text-foreground/70">
              標題 *
            </label>
            <input type="text" {...register("title")} className={inputClass} />
            {errors.title && (
              <p className="mt-1.5 text-sm text-red-300">
                {errors.title.message}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-foreground/70">
              分類
            </label>
            <select {...register("category")} className={inputClass}>
              <option value="beauty">美容</option>
              <option value="3dprint">3D 列印</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-foreground/70">
              描述
            </label>
            <textarea
              rows={3}
              {...register("description")}
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-foreground/70">
              標籤(用逗號分隔,例:霧眉, 自然款)
            </label>
            <input type="text" {...register("tags")} className={inputClass} />
          </div>

          <MediaUploader
            label="封面圖片"
            kind="image"
            currentUrl={coverUrl}
            onUploaded={(url) => setValue("cover_url", url)}
            onClear={() => setValue("cover_url", "")}
          />
          <MediaUploader
            label="影片(有影片時對外頁會顯示播放)"
            kind="video"
            currentUrl={videoUrl}
            onUploaded={(url) => setValue("video_url", url)}
            onClear={() => setValue("video_url", "")}
          />

          {serverError && (
            <p className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">
              {serverError}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-white/15 py-3 text-sm transition hover:bg-white/5"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-xl bg-brand py-3 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {isSubmitting ? "儲存中…" : "儲存"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm outline-none transition placeholder:text-foreground/30 focus:border-brand";
