"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const updateSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1, "請輸入姓名").max(100),
  phone: z.string().max(30),
  email: z.union([z.literal(""), z.email("Email 格式不正確")]),
  birthday: z.union([z.literal(""), z.iso.date("生日格式不正確")]),
  notify_email: z.boolean(),
  notify_sms: z.boolean(),
  notify_line: z.boolean(),
});

export type UpdateAccountInput = z.infer<typeof updateSchema>;

export async function updateClientAccount(
  input: UpdateAccountInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "資料格式有誤,請檢查後再試。" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "請先登入。" };
  }

  const { id, name, phone, email, birthday, ...notify } = parsed.data;

  // RLS 僅允許更新 auth_user_id = 自己的那一列;
  // 可改欄位由 DB trigger(enforce_client_self_update)把關
  const { error } = await supabase
    .from("clients")
    .update({
      name,
      phone: phone || null,
      email: email || null,
      birthday: birthday || null,
      ...notify,
    })
    .eq("id", id)
    .eq("auth_user_id", user.id);

  if (error) {
    return { ok: false, error: "儲存失敗,請稍後再試。" };
  }

  revalidatePath("/account");
  return { ok: true };
}
