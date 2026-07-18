"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { Eye, Play } from "lucide-react";
import Lightbox from "./lightbox";
import type { PortfolioItem } from "@/types/portfolio";

// 瀑布流作品畫廊:tags 篩選 + 卡片 stagger 浮現 + 點擊開啟 Lightbox
export default function WorksGallery({ items }: { items: PortfolioItem[] }) {
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [active, setActive] = useState<PortfolioItem | null>(null);
  const reduce = useReducedMotion();

  const tags = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => item.tags?.forEach((t) => set.add(t)));
    return Array.from(set);
  }, [items]);

  const filtered = activeTag
    ? items.filter((item) => item.tags?.includes(activeTag))
    : items;

  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-white/10 bg-white/5 px-5 py-12 text-center text-sm text-foreground/50">
        作品即將上架,敬請期待。
      </p>
    );
  }

  return (
    <>
      {tags.length > 0 && (
        <div className="mb-8 flex flex-wrap gap-2">
          <TagButton
            label="全部"
            active={activeTag === null}
            onClick={() => setActiveTag(null)}
          />
          {tags.map((tag) => (
            <TagButton
              key={tag}
              label={tag}
              active={activeTag === tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
            />
          ))}
        </div>
      )}

      {/* 瀑布流:CSS columns */}
      <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
        {filtered.map((item, i) => (
          <motion.button
            key={item.id}
            type="button"
            onClick={() => setActive(item)}
            initial={{ opacity: 0, y: reduce ? 0 : 26 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{
              duration: 0.55,
              delay: Math.min(i % 6, 4) * 0.07,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="group relative mb-4 block w-full break-inside-avoid overflow-hidden rounded-2xl border border-white/10 text-left"
            aria-label={`開啟作品:${item.title}`}
          >
            {item.cover_url ? (
              <Image
                src={item.cover_url}
                alt={item.title}
                width={800}
                height={1000}
                sizes="(min-width: 1024px) 340px, (min-width: 640px) 45vw, 92vw"
                className="h-auto w-full object-cover transition duration-500 group-hover:scale-[1.03]"
              />
            ) : item.video_url ? (
              <video
                src={item.video_url}
                preload="metadata"
                muted
                playsInline
                className="w-full transition duration-500 group-hover:scale-[1.03]"
              />
            ) : (
              <div className="aspect-[4/5] w-full bg-gradient-to-br from-brand/25 via-background to-[#7a5ab7]/20" />
            )}

            {item.video_url && (
              <span className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur">
                <Play className="size-4" />
              </span>
            )}

            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-4 pt-12">
              <span className="block font-medium text-white">{item.title}</span>
              <span className="mt-1 flex items-center gap-3 text-xs text-white/55">
                {item.tags && item.tags.length > 0 && (
                  <span>{item.tags.slice(0, 3).join("・")}</span>
                )}
                {item.view_count > 0 && (
                  <span className="flex items-center gap-1">
                    <Eye className="size-3" />
                    {item.view_count}
                  </span>
                )}
              </span>
            </span>
          </motion.button>
        ))}
      </div>

      {active && <Lightbox item={active} onClose={() => setActive(null)} />}
    </>
  );
}

function TagButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-1.5 text-sm transition ${
        active
          ? "border-brand bg-brand text-white"
          : "border-white/15 text-foreground/60 hover:border-brand/60 hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}
