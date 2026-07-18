"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const workSchema = z.object({
  id: z.uuid().optional(),
  title: z.string().min(1, "請輸入標題").max(200),
  category: z.enum(["beauty", "3dprint"]),
  description: z.string().max(2000),
  tags: z.string().max(500),
  cover_url: z.union([z.literal(""), z.url()]),
  video_url: z.union([z.literal(""), z.url()]),
});

export type WorkInput = z.infer<typeof workSchema>;

type ActionResult = { ok: true } | { ok: false; error: string };

// 公開頁快取一併更新
function revalidateWorks() {
  revalidatePath("/studio/works");
  revalidatePath("/works/beauty");
  revalidatePath("/works/3dprint");
  revalidatePath("/");
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function saveWork(input: WorkInput): Promise<ActionResult> {
  const parsed = workSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "資料格式有誤,請檢查後再試。" };
  }
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "請先登入。" };

  const { id, title, category, description, tags, cover_url, video_url } =
    parsed.data;

  const tagList = tags
    .split(/[,,、]/)
    .map((t) => t.trim())
    .filter(Boolean);

  const row = {
    title,
    category,
    description: description || null,
    tags: tagList.length > 0 ? tagList : null,
    cover_url: cover_url || null,
    video_url: video_url || null,
    media_type: video_url ? ("video" as const) : ("image" as const),
  };

  if (id) {
    const { error } = await supabase
      .from("portfolio_items")
      .update(row)
      .eq("id", id)
      .eq("creator_id", user.id);
    if (error) return { ok: false, error: "儲存失敗,請稍後再試。" };
  } else {
    // 新作品排在最後
    const { data: last } = await supabase
      .from("portfolio_items")
      .select("sort_order")
      .eq("creator_id", user.id)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { error } = await supabase.from("portfolio_items").insert({
      ...row,
      creator_id: user.id,
      sort_order: (last?.sort_order ?? 0) + 1,
    });
    if (error) return { ok: false, error: "新增失敗,請稍後再試。" };
  }

  revalidateWorks();
  return { ok: true };
}

export async function togglePublish(
  id: string,
  value: boolean
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "請先登入。" };

  const { error } = await supabase
    .from("portfolio_items")
    .update({ is_published: value })
    .eq("id", id)
    .eq("creator_id", user.id);
  if (error) return { ok: false, error: "更新失敗,請稍後再試。" };

  revalidateWorks();
  return { ok: true };
}

export async function deleteWork(id: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "請先登入。" };

  const { data: item } = await supabase
    .from("portfolio_items")
    .select("cover_url, video_url")
    .eq("id", id)
    .eq("creator_id", user.id)
    .maybeSingle();

  const { error } = await supabase
    .from("portfolio_items")
    .delete()
    .eq("id", id)
    .eq("creator_id", user.id);
  if (error) return { ok: false, error: "刪除失敗,請稍後再試。" };

  // 一併清掉 Storage 上的檔案(盡力而為,失敗不阻擋)
  const marker = "/object/public/portfolio/";
  const paths = [item?.cover_url, item?.video_url]
    .filter((url): url is string => Boolean(url && url.includes(marker)))
    .map((url) => decodeURIComponent(url.split(marker)[1]));
  if (paths.length > 0) {
    await supabase.storage.from("portfolio").remove(paths);
  }

  revalidateWorks();
  return { ok: true };
}

export async function reorderWorks(ids: string[]): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "請先登入。" };
  if (ids.length === 0 || ids.length > 200) {
    return { ok: false, error: "排序資料有誤。" };
  }

  const results = await Promise.all(
    ids.map((id, index) =>
      supabase
        .from("portfolio_items")
        .update({ sort_order: index + 1 })
        .eq("id", id)
        .eq("creator_id", user.id)
    )
  );
  if (results.some((r) => r.error)) {
    return { ok: false, error: "排序儲存失敗,請稍後再試。" };
  }

  revalidateWorks();
  return { ok: true };
}
