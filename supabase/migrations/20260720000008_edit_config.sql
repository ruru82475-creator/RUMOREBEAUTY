-- ============================================================
-- 單支素材後製設定(新版影片工作室流程)
-- edit_config:{ source_key, speed, caption, music_key }
-- ============================================================

alter table public.edit_projects
  add column if not exists edit_config jsonb not null default '{}'::jsonb;
