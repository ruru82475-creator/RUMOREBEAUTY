"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LayoutDashboard, LogOut, UserRound } from "lucide-react";

type Props = {
  name: string;
  email: string;
  avatarUrl: string | null;
  role: "creator" | "client";
};

// 右上角使用者選單:頭像、名稱、登出
export default function UserMenu({ name, email, avatarUrl, role }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 transition hover:bg-white/5"
      >
        <Avatar name={name} avatarUrl={avatarUrl} />
        <span className="max-w-28 truncate text-sm">{name}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-white/10 bg-[#1a161c] shadow-xl shadow-black/40"
        >
          <div className="border-b border-white/10 px-4 py-3">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="truncate text-xs text-foreground/50">{email}</p>
          </div>

          {role === "creator" ? (
            <MenuLink
              href="/studio"
              icon={<LayoutDashboard className="size-4" />}
              label="創作者後台"
              onNavigate={() => setOpen(false)}
            />
          ) : (
            <MenuLink
              href="/account"
              icon={<UserRound className="size-4" />}
              label="我的資料"
              onNavigate={() => setOpen(false)}
            />
          )}

          <form action="/auth/signout" method="post">
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-foreground/80 transition hover:bg-white/5 hover:text-foreground"
            >
              <LogOut className="size-4" />
              登出
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function MenuLink({
  href,
  icon,
  label,
  onNavigate,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onNavigate}
      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground/80 transition hover:bg-white/5 hover:text-foreground"
    >
      {icon}
      {label}
    </Link>
  );
}

function Avatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  if (avatarUrl) {
    return (
      // 頭像來源為外部網址(如 Google),不經 next/image 最佳化
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        className="size-8 rounded-full object-cover"
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <span className="flex size-8 items-center justify-center rounded-full bg-brand text-sm font-medium text-white">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
