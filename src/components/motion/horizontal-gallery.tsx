"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export type GalleryWork = {
  id: string;
  title: string;
  category: string | null;
  cover_url: string | null;
  video_url: string | null;
};

// 尚無作品時的佔位卡片
const PLACEHOLDERS: GalleryWork[] = [
  { id: "p1", title: "精選作品即將上架", category: "beauty", cover_url: null, video_url: null },
  { id: "p2", title: "敬請期待", category: "beauty", cover_url: null, video_url: null },
  { id: "p3", title: "客製作品", category: "3dprint", cover_url: null, video_url: null },
  { id: "p4", title: "更多作品籌備中", category: "beauty", cover_url: null, video_url: null },
];

// 精選作品:桌機為 GSAP ScrollTrigger 水平捲動(pin + scrub);
// 手機與 reduced-motion 降級為原生橫向滑動
export default function HorizontalGallery({ works }: { works: GalleryWork[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

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

  const items = works.length > 0 ? works : PLACEHOLDERS;

  return (
    <div ref={wrapRef} className="py-20 md:py-24">
      <div className="mx-auto mb-10 flex max-w-5xl items-end justify-between px-4">
        <div>
          <p className="mb-2 text-xs tracking-[0.35em] text-brand">PORTFOLIO</p>
          <h2 className="font-serif text-3xl sm:text-4xl">精選作品</h2>
        </div>
        <nav className="flex gap-4 pb-1 text-sm" aria-label="作品集頁面">
          <Link
            href="/works/beauty"
            className="text-foreground/55 underline-offset-4 transition hover:text-brand hover:underline"
          >
            美容作品集
          </Link>
          <Link
            href="/works/3dprint"
            className="text-foreground/55 underline-offset-4 transition hover:text-brand hover:underline"
          >
            3D 列印
          </Link>
        </nav>
      </div>

      <div ref={scrollerRef} className="gallery-scroller overflow-x-auto pb-4">
        <div
          ref={trackRef}
          className="flex w-max gap-5 px-4 md:px-[max(1rem,calc((100vw-64rem)/2))]"
        >
          {items.map((work) => (
            <WorkCard key={work.id} work={work} />
          ))}
        </div>
      </div>
    </div>
  );
}

function WorkCard({ work }: { work: GalleryWork }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  return (
    <article
      className="group relative h-[420px] w-[75vw] shrink-0 overflow-hidden rounded-2xl border border-white/10 sm:w-[300px] md:h-[460px] md:w-[340px]"
      onMouseEnter={() => videoRef.current?.play().catch(() => {})}
      onMouseLeave={() => {
        const v = videoRef.current;
        if (v) {
          v.pause();
          v.currentTime = 0;
        }
      }}
    >
      {work.cover_url ? (
        <Image
          src={work.cover_url}
          alt={work.title}
          fill
          sizes="(min-width: 768px) 340px, 75vw"
          className="object-cover transition duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-brand/25 via-background to-[#7a5ab7]/20" />
      )}

      {work.video_url && (
        <video
          ref={videoRef}
          src={work.video_url}
          muted
          loop
          playsInline
          preload="none"
          className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        />
      )}

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-5 pt-16">
        <p className="text-[11px] tracking-[0.25em] text-brand">
          {work.category === "3dprint" ? "3D 列印" : "美容作品"}
        </p>
        <h3 className="mt-1 font-medium">{work.title}</h3>
      </div>
    </article>
  );
}
