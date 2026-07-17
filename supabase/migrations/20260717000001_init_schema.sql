-- ============================================================
-- GlowStudio 初始 schema
-- 七張核心資料表,全部啟用 RLS(專案憲法鐵律 4)
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 輔助函式:判斷某使用者是否為 creator
-- security definer 避免在 policy 內查 profiles 造成 RLS 遞迴
-- ------------------------------------------------------------
create or replace function public.is_creator(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = uid and p.role = 'creator'
  );
$$;

-- ============================================================
-- profiles:使用者延伸資料
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'client' check (role in ('creator', 'client')),
  display_name text,
  avatar_url text,
  bio text,
  brand_color text not null default '#B76E79',
  phone text,
  line_user_id text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- 本人可讀自己的 profile
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

-- creator 的 profile 對外公開(對外形象頁需要顯示品牌色、簡介等)
create policy "profiles_select_creator_public"
  on public.profiles for select
  to anon, authenticated
  using (role = 'creator');

-- 本人可建立/更新自己的 profile(role 變更由 trigger 擋下)
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (id = (select auth.uid()));

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- 禁止使用者自行變更角色(升級為 creator 只能由 service role 執行)
create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception '不允許自行變更角色';
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_escalation();

-- 註冊時自動建立 profile
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'display_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- portfolio_items:作品集(美容 + 3D列印共用,以 category 區分)
-- ============================================================
create table public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles (id) on delete cascade,
  category text check (category in ('beauty', '3dprint')),
  title text not null,
  description text,
  cover_url text,
  video_url text,
  media_type text check (media_type in ('video', 'image')),
  tags text[],
  is_published boolean not null default false,
  sort_order int not null default 0,
  view_count int not null default 0,
  created_at timestamptz not null default now()
);

create index portfolio_items_creator_id_idx on public.portfolio_items (creator_id);
create index portfolio_items_published_idx on public.portfolio_items (is_published, sort_order);

alter table public.portfolio_items enable row level security;

-- creator 可完全存取自己的作品
create policy "portfolio_items_creator_all"
  on public.portfolio_items for all
  to authenticated
  using (creator_id = (select auth.uid()))
  with check (creator_id = (select auth.uid()) and public.is_creator((select auth.uid())));

-- 已發布作品允許匿名讀取(對外形象頁)
create policy "portfolio_items_public_read"
  on public.portfolio_items for select
  to anon, authenticated
  using (is_published = true);

-- ============================================================
-- clients:客戶資料(CRM)
-- ============================================================
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles (id) on delete cascade,
  auth_user_id uuid references auth.users (id) on delete set null, -- 客戶若註冊帳號則綁定
  name text not null,
  phone text,
  email text,
  line_user_id text,
  birthday date,
  notes text,
  tags text[],
  notify_email boolean not null default true,
  notify_sms boolean not null default false,
  notify_line boolean not null default true,
  last_visit_at timestamptz,
  created_at timestamptz not null default now()
);

create index clients_creator_id_idx on public.clients (creator_id);
create index clients_auth_user_id_idx on public.clients (auth_user_id);

alter table public.clients enable row level security;

-- creator 可完全存取自己的客戶
create policy "clients_creator_all"
  on public.clients for all
  to authenticated
  using (creator_id = (select auth.uid()))
  with check (creator_id = (select auth.uid()) and public.is_creator((select auth.uid())));

-- 已綁定帳號的客戶可讀自己那一列
create policy "clients_self_select"
  on public.clients for select
  to authenticated
  using (auth_user_id = (select auth.uid()));

-- 已綁定帳號的客戶可更新自己那一列(可改欄位由 trigger 限制為通知偏好)
create policy "clients_self_update"
  on public.clients for update
  to authenticated
  using (auth_user_id = (select auth.uid()))
  with check (auth_user_id = (select auth.uid()));

-- 客戶本人(非站主)只能修改 notify_email / notify_sms / notify_line
create or replace function public.enforce_client_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select auth.uid()) = old.auth_user_id
     and (select auth.uid()) is distinct from old.creator_id then
    if (new.creator_id, new.auth_user_id, new.name, new.phone, new.email,
        new.line_user_id, new.birthday, new.notes, new.tags,
        new.last_visit_at, new.created_at)
       is distinct from
       (old.creator_id, old.auth_user_id, old.name, old.phone, old.email,
        old.line_user_id, old.birthday, old.notes, old.tags,
        old.last_visit_at, old.created_at) then
      raise exception '客戶僅能修改通知偏好設定';
    end if;
  end if;
  return new;
end;
$$;

create trigger clients_enforce_self_update
  before update on public.clients
  for each row execute function public.enforce_client_self_update();

-- ============================================================
-- notifications:通知紀錄
-- ============================================================
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null, -- null = 群發
  channel text not null check (channel in ('email', 'sms', 'line')),
  subject text,
  body text,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_creator_id_idx on public.notifications (creator_id);
create index notifications_client_id_idx on public.notifications (client_id);

alter table public.notifications enable row level security;

-- 只有 creator 本人可存取自己的通知紀錄
create policy "notifications_creator_all"
  on public.notifications for all
  to authenticated
  using (creator_id = (select auth.uid()))
  with check (creator_id = (select auth.uid()) and public.is_creator((select auth.uid())));

-- ============================================================
-- video_templates:影片樣板(方案 C+D 核心)
-- ============================================================
-- slots JSON 結構範例:
-- [{ "slot_id": "s1", "name": "門面外觀",
--    "instruction": "請拍攝店面外觀,鏡頭由左至右緩慢平移",
--    "duration_sec": 3, "shot_type": "wide",
--    "composition_hint": "招牌置於畫面上1/3",
--    "validation": { "min_duration": 3, "required_content": "店面或招牌",
--                    "brightness_check": true } }]
create table public.video_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  preview_url text,                       -- 樣板示範影片
  remotion_composition_id text not null,  -- 對應 Remotion 元件 ID
  aspect_ratio text not null default '9:16' check (aspect_ratio in ('9:16', '1:1', '16:9')),
  total_duration_sec numeric,
  slots jsonb not null check (jsonb_typeof(slots) = 'array'), -- 槽位定義陣列
  music_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.video_templates enable row level security;

-- 已登入者可讀取樣板;寫入僅限 service role(繞過 RLS),故不建立寫入 policy
create policy "video_templates_authenticated_read"
  on public.video_templates for select
  to authenticated
  using (true);

-- ============================================================
-- edit_projects:剪輯專案(使用者的一次剪輯任務)
-- ============================================================
create table public.edit_projects (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles (id) on delete cascade,
  template_id uuid references public.video_templates (id) on delete restrict,
  status text not null default 'shooting'
    check (status in ('shooting', 'validating', 'ready', 'rendering', 'done', 'failed')),
  slot_uploads jsonb not null default '[]', -- [{ slot_id, r2_key, duration, validated, ai_feedback }]
  output_url text,
  render_progress numeric not null default 0,
  error_message text,
  created_at timestamptz not null default now()
);

create index edit_projects_creator_id_idx on public.edit_projects (creator_id);

alter table public.edit_projects enable row level security;

-- 只有 creator 本人可存取自己的剪輯專案
create policy "edit_projects_creator_all"
  on public.edit_projects for all
  to authenticated
  using (creator_id = (select auth.uid()))
  with check (creator_id = (select auth.uid()) and public.is_creator((select auth.uid())));

-- ============================================================
-- social_posts:社群發布紀錄
-- ============================================================
create table public.social_posts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles (id) on delete cascade,
  edit_project_id uuid references public.edit_projects (id) on delete set null,
  portfolio_item_id uuid references public.portfolio_items (id) on delete set null,
  platforms text[] not null, -- ['instagram','facebook','twitter','threads']
  caption text,
  ayrshare_post_id text,
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'published', 'failed')),
  scheduled_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create index social_posts_creator_id_idx on public.social_posts (creator_id);

alter table public.social_posts enable row level security;

-- 只有 creator 本人可存取自己的發布紀錄
create policy "social_posts_creator_all"
  on public.social_posts for all
  to authenticated
  using (creator_id = (select auth.uid()))
  with check (creator_id = (select auth.uid()) and public.is_creator((select auth.uid())));
