"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ArrowDown } from "lucide-react";

type Props = {
  name: string;
  tagline: string;
  videoUrl: string | null;
};

// 全螢幕 Hero:名稱逐字浮現(自行實作字元拆分,不用付費外掛)
// + 滑鼠視差(桌機限定);reduced-motion 時全部直接顯示
export default function Hero({ name, tagline, videoUrl }: Props) {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ctx = gsap.context(() => {
      const chars = root.querySelectorAll("[data-char]");
      const fades = root.querySelectorAll("[data-hero-fade]");

      if (reduce) {
        gsap.set(chars, { opacity: 1, y: 0 });
        gsap.set(fades, { opacity: 1, y: 0 });
        return;
      }

      gsap
        .timeline({ defaults: { ease: "power4.out" } })
        .to(chars, { opacity: 1, y: 0, duration: 1.1, stagger: 0.045 }, 0.2)
        .to(fades, { opacity: 1, y: 0, duration: 0.9, stagger: 0.15 }, "-=0.75");
    }, root);

    // 滑鼠視差:桌機(pointer: fine)且未要求減少動態時才啟用;手機不做視差
    let removeMove: (() => void) | undefined;
    if (!reduce && window.matchMedia("(pointer: fine)").matches) {
      const layers = Array.from(
        root.querySelectorAll<HTMLElement>("[data-depth]")
      ).map((el) => ({
        depth: parseFloat(el.dataset.depth ?? "0"),
        x: gsap.quickTo(el, "x", { duration: 0.8, ease: "power3.out" }),
        y: gsap.quickTo(el, "y", { duration: 0.8, ease: "power3.out" }),
      }));
      const onMove = (e: MouseEvent) => {
        const dx = e.clientX / window.innerWidth - 0.5;
        const dy = e.clientY / window.innerHeight - 0.5;
        layers.forEach((l) => {
          l.x(dx * l.depth * 70);
          l.y(dy * l.depth * 70);
        });
      };
      window.addEventListener("mousemove", onMove);
      removeMove = () => window.removeEventListener("mousemove", onMove);
    }

    return () => {
      ctx.revert();
      removeMove?.();
    };
  }, []);

  const words = name.split(/\s+/).filter(Boolean);

  return (
    <section
      ref={rootRef}
      className="relative flex min-h-[calc(100dvh-3.5rem)] flex-col items-center justify-center overflow-hidden px-4 text-center"
    >
      {videoUrl ? (
        <>
          <video
            src={videoUrl}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-background/70" aria-hidden />
        </>
      ) : (
        <div className="absolute inset-0" aria-hidden>
          <div data-depth="0.5" className="absolute -top-[12%] left-[-18%]">
            <div className="hero-blob size-[55vmax] rounded-full bg-brand/25 blur-[110px]" />
          </div>
          <div data-depth="0.9" className="absolute bottom-[-18%] right-[-14%]">
            <div className="hero-blob-2 size-[45vmax] rounded-full bg-[#7a5ab7]/20 blur-[110px]" />
          </div>
          <div className="hero-grid absolute inset-0" />
        </div>
      )}

      <div className="relative">
        <p
          data-hero-fade
          className="mb-6 translate-y-4 text-xs tracking-[0.45em] text-brand opacity-0"
        >
          BEAUTY &amp; CRAFT STUDIO
        </p>
        <h1
          aria-label={name}
          className="font-serif text-[clamp(2.8rem,11vw,7rem)] leading-[1.08]"
        >
          {words.map((word, wi) => (
            <span
              key={wi}
              aria-hidden
              className="mr-[0.26em] inline-block overflow-hidden whitespace-nowrap align-bottom last:mr-0"
            >
              {Array.from(word).map((ch, ci) => (
                <span
                  key={ci}
                  data-char
                  className="inline-block translate-y-[1.15em] opacity-0"
                >
                  {ch}
                </span>
              ))}
            </span>
          ))}
        </h1>
        <p
          data-hero-fade
          className="mx-auto mt-8 max-w-md translate-y-4 text-sm leading-relaxed text-foreground/60 opacity-0 sm:text-base"
        >
          {tagline}
        </p>
      </div>

      <div
        data-hero-fade
        className="absolute bottom-8 flex translate-y-4 flex-col items-center gap-2 text-foreground/40 opacity-0"
      >
        <span className="text-[11px] tracking-[0.3em]">SCROLL</span>
        <ArrowDown className="size-4 motion-safe:animate-bounce" />
      </div>
    </section>
  );
}
