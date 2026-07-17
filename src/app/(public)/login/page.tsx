import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LoginForm from "./login-form";

export const metadata = { title: "登入 | GlowStudio" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const safeNext = next && next.startsWith("/") ? next : "/";

  // 已登入者直接導向目的地
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(safeNext);

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <p className="mb-3 text-xs tracking-[0.35em] text-brand">GLOWSTUDIO</p>
          <h1 className="font-serif text-3xl">歡迎回來</h1>
          <p className="mt-3 text-sm text-foreground/50">
            使用 Email 或 Google 帳號登入
          </p>
        </div>
        {error === "auth" && (
          <p className="mb-6 rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">
            登入連結無效或已過期,請重新登入。
          </p>
        )}
        <LoginForm next={safeNext} />
      </div>
    </main>
  );
}
