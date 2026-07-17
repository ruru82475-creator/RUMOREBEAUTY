import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import UserMenu from "./user-menu";

// 全站共用頁首:左側品牌名,右上角使用者選單
export default async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: {
    display_name: string | null;
    avatar_url: string | null;
    role: "creator" | "client";
  } | null = null;

  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("display_name, avatar_url, role")
      .eq("id", user.id)
      .single();
    profile = data;
  }

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="font-serif text-lg tracking-widest">
          GlowStudio
        </Link>
        {user ? (
          <UserMenu
            name={profile?.display_name || user.email || "使用者"}
            email={user.email ?? ""}
            avatarUrl={profile?.avatar_url ?? null}
            role={profile?.role ?? "client"}
          />
        ) : (
          <Link
            href="/login"
            className="rounded-full border border-white/15 px-4 py-1.5 text-sm transition hover:border-brand hover:text-brand"
          >
            登入
          </Link>
        )}
      </div>
    </header>
  );
}
