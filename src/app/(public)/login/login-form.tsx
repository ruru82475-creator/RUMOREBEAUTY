"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const loginSchema = z.object({
  email: z.email("請輸入有效的 Email 地址"),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginForm({ next }: { next: string }) {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const supabase = createClient();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "" },
  });

  const redirectTo = () =>
    `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function onSubmit(values: LoginValues) {
    setServerError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: values.email,
      options: { emailRedirectTo: redirectTo() },
    });
    if (error) {
      setServerError("登入信寄送失敗,請稍後再試。");
      return;
    }
    setSentTo(values.email);
  }

  async function signInWithGoogle() {
    setServerError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo() },
    });
    if (error) setServerError("Google 登入失敗,請稍後再試。");
  }

  if (sentTo) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-10 text-center">
        <MailCheck className="mx-auto mb-4 size-10 text-brand" />
        <h2 className="text-lg font-medium">登入連結已寄出</h2>
        <p className="mt-2 text-sm leading-relaxed text-foreground/60">
          已寄送登入連結到
          <br />
          <span className="text-foreground">{sentTo}</span>
          <br />
          請至信箱點擊連結完成登入。
        </p>
        <button
          type="button"
          onClick={() => setSentTo(null)}
          className="mt-6 text-sm text-brand underline-offset-4 hover:underline"
        >
          使用其他 Email 重新寄送
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm text-foreground/70">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            {...register("email")}
            className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm outline-none transition placeholder:text-foreground/30 focus:border-brand"
          />
          {errors.email && (
            <p className="mt-1.5 text-sm text-red-300">{errors.email.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-brand py-3 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {isSubmitting ? "寄送中…" : "寄送登入連結"}
        </button>
      </form>

      <div className="flex items-center gap-3 text-xs text-foreground/40">
        <span className="h-px flex-1 bg-white/10" />
        或
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <button
        type="button"
        onClick={signInWithGoogle}
        className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/15 py-3 text-sm transition hover:bg-white/5"
      >
        <GoogleIcon />
        使用 Google 登入
      </button>

      {serverError && (
        <p className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">
          {serverError}
        </p>
      )}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.09 3.57-5.17 3.57-8.81z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.93-2.92l-3.87-3c-1.07.72-2.44 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.29v3.1A11.99 11.99 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.29 14.28A7.23 7.23 0 0 1 4.9 12c0-.79.14-1.56.38-2.28v-3.1H1.29a12.02 12.02 0 0 0 0 10.76l4-3.1z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.58 1.8l3.43-3.44C17.95 1.19 15.24 0 12 0A11.99 11.99 0 0 0 1.29 6.62l4 3.1C6.23 6.88 8.88 4.77 12 4.77z"
      />
    </svg>
  );
}
