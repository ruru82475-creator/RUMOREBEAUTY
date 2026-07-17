"use client";

import { useRef } from "react";

// 滑鼠懸停微傾斜卡片;觸控裝置與 reduced-motion 時不作用
export default function TiltCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function handleMove(e: React.MouseEvent) {
    const el = ref.current;
    if (!el) return;
    if (
      window.matchMedia("(pointer: coarse)").matches ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const rect = el.getBoundingClientRect();
    const rx = ((e.clientY - rect.top) / rect.height - 0.5) * -7;
    const ry = ((e.clientX - rect.left) / rect.width - 0.5) * 7;
    el.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-4px)`;
  }

  function handleLeave() {
    const el = ref.current;
    if (el) el.style.transform = "";
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className={`transition-transform duration-300 will-change-transform ${className ?? ""}`}
    >
      {children}
    </div>
  );
}
