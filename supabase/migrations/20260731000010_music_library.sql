-- ============================================================
-- 背景音樂資源庫
-- 曲目檔案存於 R2(music/ 前綴),這張表存後設資料與 mood 分類
-- mood:chill(輕柔) / upbeat(活潑) / elegant(典雅) /
--       energetic(動感) / cinematic(電影感)
-- ============================================================

create table if not exists public.music_library (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  artist text,
  mood text not null default 'chill'
    check (mood in ('chill', 'upbeat', 'elegant', 'energetic', 'cinematic')),
  genre text,
  duration_sec numeric,
  file_url text not null,          -- 站內媒體路徑 /api/media/music/xxx.mp3
  tags text[],
  bpm integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists music_library_creator_idx
  on public.music_library (creator_id);
create index if not exists music_library_mood_idx
  on public.music_library (mood, is_active);

alter table public.music_library enable row level security;

-- 站主可完整管理自己的音樂庫
create policy "music_library_creator_all"
  on public.music_library for all
  to authenticated
  using (creator_id = (select auth.uid()))
  with check (
    creator_id = (select auth.uid())
    and public.is_creator((select auth.uid()))
  );

-- ============================================================
-- 模板的預設配樂氛圍(選了模板就自動配同 mood 的音樂)
-- ============================================================
update public.video_templates
set edit_preset = edit_preset || jsonb_build_object('mood', m.mood)
from (values
  ('StyleCream',     'elegant'),
  ('StylePorcelain', 'elegant'),
  ('StyleAiry',      'chill'),
  ('StyleMuted',     'chill'),
  ('StylePeach',     'upbeat'),
  ('StyleTimelapse', 'energetic'),
  ('StyleRetro',     'cinematic'),
  ('StyleMono',      'cinematic')
) as m(composition_id, mood)
where public.video_templates.remotion_composition_id = m.composition_id;
