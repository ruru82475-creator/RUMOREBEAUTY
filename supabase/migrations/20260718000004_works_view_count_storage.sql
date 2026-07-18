-- ============================================================
-- 作品集功能
-- 1. view_count 計數 RPC(前端以 sessionStorage 限制同 session 只呼叫一次)
-- 2. Supabase Storage bucket「portfolio」(R2 接上前的暫代方案)
--    公開讀取;僅 creator 可上傳/刪除
-- ============================================================

create or replace function public.increment_view_count(item_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.portfolio_items
  set view_count = view_count + 1
  where id = item_id and is_published = true;
$$;

-- 建立公開讀取的 portfolio bucket
insert into storage.buckets (id, name, public)
values ('portfolio', 'portfolio', true)
on conflict (id) do nothing;

-- Storage 權限:任何人可讀,僅 creator 可寫
create policy "portfolio_public_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'portfolio');

create policy "portfolio_creator_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'portfolio' and public.is_creator(auth.uid()));

create policy "portfolio_creator_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'portfolio' and public.is_creator(auth.uid()))
  with check (bucket_id = 'portfolio' and public.is_creator(auth.uid()));

create policy "portfolio_creator_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'portfolio' and public.is_creator(auth.uid()));
