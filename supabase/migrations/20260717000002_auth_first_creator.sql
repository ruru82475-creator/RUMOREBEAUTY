-- ============================================================
-- 認證系統調整
-- 1. 第一個註冊的帳號自動成為 creator,其餘為 client
-- 2. 綁定客戶可自行編輯聯絡資料 + 通知偏好(原先僅通知偏好)
-- ============================================================

-- 註冊時自動建立 profile;第一位使用者自動成為 creator
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  -- advisory lock 避免同時註冊時產生兩位 creator
  perform pg_advisory_xact_lock(20260717);

  select case
    when exists (select 1 from public.profiles) then 'client'
    else 'creator'
  end into v_role;

  insert into public.profiles (id, role, display_name, avatar_url)
  values (
    new.id,
    v_role,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    ),
    coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 放寬客戶本人可編輯的欄位:聯絡資料(name/phone/email/line_user_id/birthday)
-- 與通知偏好(notify_*);仍鎖定 creator_id、auth_user_id、notes、tags、
-- last_visit_at、created_at(僅站主或 service role 可改)
create or replace function public.enforce_client_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select auth.uid()) = old.auth_user_id
     and (select auth.uid()) is distinct from old.creator_id then
    if (new.creator_id, new.auth_user_id, new.notes, new.tags,
        new.last_visit_at, new.created_at)
       is distinct from
       (old.creator_id, old.auth_user_id, old.notes, old.tags,
        old.last_visit_at, old.created_at) then
      raise exception '此欄位僅站主可修改';
    end if;
  end if;
  return new;
end;
$$;
