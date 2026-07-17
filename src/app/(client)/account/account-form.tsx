"use client";

import { useState } from "react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { updateClientAccount } from "./actions";

export type ClientAccount = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  birthday: string | null;
  notify_email: boolean;
  notify_sms: boolean;
  notify_line: boolean;
};

const formSchema = z.object({
  name: z.string().min(1, "請輸入姓名").max(100, "姓名過長"),
  phone: z.string().max(30, "電話號碼過長"),
  email: z.union([z.literal(""), z.email("Email 格式不正確")]),
  birthday: z.string(),
  notify_email: z.boolean(),
  notify_sms: z.boolean(),
  notify_line: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

export default function AccountForm({ client }: { client: ClientAccount }) {
  const [message, setMessage] = useState<
    { type: "ok" | "error"; text: string } | null
  >(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: client.name,
      phone: client.phone ?? "",
      email: client.email ?? "",
      birthday: client.birthday ?? "",
      notify_email: client.notify_email,
      notify_sms: client.notify_sms,
      notify_line: client.notify_line,
    },
  });

  async function onSubmit(values: FormValues) {
    setMessage(null);
    const result = await updateClientAccount({ id: client.id, ...values });
    if (result.ok) {
      setMessage({ type: "ok", text: "已儲存。" });
    } else {
      setMessage({ type: "error", text: result.error });
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 space-y-5">
      <Field label="姓名" error={errors.name?.message}>
        <input
          type="text"
          autoComplete="name"
          {...register("name")}
          className={inputClass}
        />
      </Field>

      <Field label="手機" error={errors.phone?.message}>
        <input
          type="tel"
          autoComplete="tel"
          placeholder="0912-345-678"
          {...register("phone")}
          className={inputClass}
        />
      </Field>

      <Field label="Email" error={errors.email?.message}>
        <input
          type="email"
          autoComplete="email"
          {...register("email")}
          className={inputClass}
        />
      </Field>

      <Field label="生日" error={errors.birthday?.message}>
        <input
          type="date"
          {...register("birthday")}
          className={`${inputClass} [color-scheme:dark]`}
        />
      </Field>

      <fieldset className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <legend className="px-1 text-sm text-foreground/70">通知偏好</legend>
        <div className="space-y-3">
          <Toggle label="Email 通知" {...register("notify_email")} />
          <Toggle label="簡訊通知" {...register("notify_sms")} />
          <Toggle label="LINE 通知" {...register("notify_line")} />
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-xl bg-brand py-3 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {isSubmitting ? "儲存中…" : "儲存變更"}
      </button>

      {message && (
        <p
          role="status"
          className={
            message.type === "ok"
              ? "rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200"
              : "rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200"
          }
        >
          {message.text}
        </p>
      )}
    </form>
  );
}

const inputClass =
  "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm outline-none transition placeholder:text-foreground/30 focus:border-brand";

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm text-foreground/70">{label}</label>
      {children}
      {error && <p className="mt-1.5 text-sm text-red-300">{error}</p>}
    </div>
  );
}

function Toggle({
  label,
  ...props
}: { label: string } & UseFormRegisterReturn) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      {label}
      <input type="checkbox" {...props} className="size-4 accent-brand" />
    </label>
  );
}
