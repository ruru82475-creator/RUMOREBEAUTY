"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Play } from "lucide-react";
import Lightbox from "@/components/ui/lightbox";

export type GalleryWork = {
  id: string;
  title: string;
  category: string | null;
  description: string | null;
  cover_url: string | null;
  video_url: string | null;
};

// 尚無作品時的佔位卡片(不可點擊)
function placeholdersFor(category: "beauty" | "3dprint"): GalleryWork[] {
  const base = { description: null, cover_url: null, video_url: null, category };
  return [
    { id: `ph-${category}-1`, title: "精選作品即將上架", ...base },
    { id: `ph-${category}-2`, title: "敬請期待", ...base },
    { id: `ph-${category}-3`, title: "更多作品籌備中", ...base },
  ];
}

// 精選作品橫向畫廊(單一分類一個區塊)
// 桌機:GSAP ScrollTrigger 水平捲動(pin + scrub);手機/reduced-motion:原生橫向滑動
// 點擊卡片直接開 Lightbox 觀賞
export default function HorizontalGallery({
  works,
  category,
  eyebrow,
  title,
  moreHref,
}: {
  works: GalleryWork[];
  category: "beauty" | "3dprint";
  eyebrow: string;
  title: string;
  moreHref: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<GalleryWork | null>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();

    mm.add(
      "(min-width: 768px) and (prefers-reduced-motion: no-preference)",
      () => {
        const wrap = wrapRef.current;
        const scroller = scrollerRef.current;
        const track = trackRef.current;
        if (!wrap || !scroller || !track) return;

        scroller.style.overflowX = "hidden";
        const distance = () =>
          Math.max(0, track.scrollWidth - scroller.clientWidth);

        const tween = gsap.to(track, {
          x: () => -distance(),
          ease: "none",
          scrollTrigger: {
            trigger: wrap,
            start: "top top",
            end: () => `+=${distance()}`,
            pin: true,
            scrub: 1,
            invalidateOnRefresh: true,
          },
        });

        return () => {
          tween.scrollTrigger?.kill();
          tween.kill();
          scroller.style.overflowX = "";
          gsap.set(track, { x: 0 });
        };
      }
    );

    return () => mm.revert();
  }, []);

  const isEmpty = works.length === 0;
  const items = isEmpty ? placeholdersFor(category) : works;

  return (
    <div ref={wrapRef} className="py-16 md:py-20">
      <div className="mx-auto mb-10 flex max-w-5xl items-end justify-between px-4">
        <div>
          <p className="mb-2 text-xs tracking-[0.35em] text-brand">{eyebrow}</p>
          <h2 className="font-serif text-3xl sm:text-4xl">{title}</h2>
        </div>
        <Link
          href={moreHref}
          className="pb-1 text-sm text-foreground/55 underline-offset-4 transition hover:text-brand hover:underline"
        >
          查看全部 →
        </Link>
      </div>

      <div ref={scrollerRef} className="gallery-scroller overflow-x-auto pb-4">
        <div
          ref={trackRef}
          className="flex w-max gap-5 px-4 md:px-[max(1rem,calc((100vw-64rem)/2))]"
        >
          {items.map((work) => (
            <WorkCard
              key={work.id}
              work={work}
              clickable={!isEmpty && Boolean(work.video_url || work.cover_url)}
              onOpen={() => setActive(work)}
            />
          ))}
        </div>
      </div>

      {active && <Lightbox item={active} onClose={() => setActive(null)} />}
    </div>
  );
}

function WorkCard({
  work,
  clickable,
  onOpen,
}: {
  work: GalleryWork;
  clickable: boolean;
  onOpen: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const inner = (
    <>
      {work.cover_url ? (
        <Image
          src={work.cover_url}
          alt={work.title}
          fill
          sizes="(min-width: 768px) 340px, 75vw"
          className="object-cover transition duration-500 group-hover:scale-105"
        />
      ) : work.video_url ? (
        <video
          src={work.video_url}
          preload="metadata"
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-brand/25 via-background to-[#7a5ab7]/20" />
      )}

      {work.video_url && (
        <>
          <video
            ref={videoRef}
            src={work.video_url}
            muted
            loop
            playsInline
            preload="none"
            className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          />
          <span className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur">
            <Play className="size-4" />
          </span>
        </>
      )}

      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-5 pt-16 text-left">
        <span className="block text-[11px] tracking-[0.25em] text-brand">
          {work.category === "3dprint" ? "3D 列印" : "美容作品"}
        </span>
        <span className="mt-1 block font-medium text-white">{work.title}</span>
      </span>
    </>
  );

  const className =
    "group relative h-[420px] w-[75vw] shrink-0 overflow-hidden rounded-2xl border border-white/10 sm:w-[300px] md:h-[460px] md:w-[340px]";

  if (!clickable) {
    return <article className={className}>{inner}</article>;
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`觀賞作品:${work.title}`}
      onMouseEnter={() => videoRef.current?.play().catch(() => {})}
      onMouseLeave={() => {
        const v = videoRef.current;
        if (v) {
          v.pause();
          v.currentTime = 0;
        }
      }}
      className={`${className} cursor-pointer`}
    >
      {inner}
    </button>
  );
}
