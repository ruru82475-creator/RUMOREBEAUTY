-- ============================================================
-- 美圖秀秀風格的一鍵套用模板
-- edit_preset:選擇模板時自動帶入的後製設定
--   { beauty, effect, speed, transition, caption_style, music_hint }
-- ============================================================

alter table public.video_templates
  add column if not exists edit_preset jsonb not null default '{}'::jsonb;

-- 舊的多鏡頭槽位模板已不適用單支素材流程,先停用(資料保留)
update public.video_templates
set is_active = false
where remotion_composition_id in
  ('BeforeAfterCompare', 'ServiceJourney', 'PrintUnboxing');

-- 以 remotion_composition_id 當唯一鍵,重複執行不會產生重複資料
insert into public.video_templates
  (name, description, remotion_composition_id, aspect_ratio,
   total_duration_sec, slots, edit_preset)
select * from (values
  (
    '奶油肌特寫',
    '溫潤柔和的膚色調性,搭配自然磨皮 — 美甲、唇部、紋繡特寫的萬用款。',
    'StyleCream', '9:16', 15, '[]'::jsonb,
    '{"beauty":"standard","effect":"cream","speed":2,"transition":"fade","caption_style":"classic","music_hint":"soft piano"}'::jsonb
  ),
  (
    '冷白透亮',
    '偏冷的白皙通透感,乾淨俐落 — 適合美睫、美容儀器、清潔感訴求。',
    'StylePorcelain', '9:16', 15, '[]'::jsonb,
    '{"beauty":"standard","effect":"porcelain","speed":2,"transition":"fade","caption_style":"classic","music_hint":"clean ambient"}'::jsonb
  ),
  (
    '蜜桃甜心',
    '粉嫩甜美的色調 — 美甲彩繪、唇妝、少女風作品首選。',
    'StylePeach', '9:16', 15, '[]'::jsonb,
    '{"beauty":"natural","effect":"peach","speed":2,"transition":"fade","caption_style":"rose","music_hint":"cute upbeat"}'::jsonb
  ),
  (
    '日系空氣感',
    '低對比高明亮的日雜風格,柔和不刺眼 — 沙龍環境、日常紀錄。',
    'StyleAiry', '9:16', 20, '[]'::jsonb,
    '{"beauty":"natural","effect":"airy","speed":4,"transition":"zoom","caption_style":"classic","music_hint":"lofi relaxing"}'::jsonb
  ),
  (
    '港風復古',
    '膠片顆粒與暗角營造的復古氛圍 — 想做出有記憶點的品牌感就選它。',
    'StyleRetro', '9:16', 15, '[]'::jsonb,
    '{"beauty":"natural","effect":"retro","speed":2,"transition":"fade","caption_style":"gold","music_hint":"retro jazz"}'::jsonb
  ),
  (
    '高級灰質感',
    '低飽和的雜誌質感 — 3D 列印作品、金屬與材質特寫特別出色。',
    'StyleMuted', '9:16', 18, '[]'::jsonb,
    '{"beauty":"off","effect":"muted","speed":4,"transition":"zoom","caption_style":"ink","music_hint":"minimal electronic"}'::jsonb
  ),
  (
    '縮時全記錄',
    '把長時間施作壓縮成短片的縮時模板,8 倍速 + 自然膚色。',
    'StyleTimelapse', '9:16', 20, '[]'::jsonb,
    '{"beauty":"natural","effect":"cream","speed":8,"transition":"fade","caption_style":"classic","music_hint":"energetic upbeat"}'::jsonb
  ),
  (
    '黑白質感',
    '純黑白強調線條與紋理 — 適合手法特寫、工具細節。',
    'StyleMono', '9:16', 15, '[]'::jsonb,
    '{"beauty":"natural","effect":"mono","speed":2,"transition":"fade","caption_style":"classic","music_hint":"cinematic calm"}'::jsonb
  )
) as t(name, description, remotion_composition_id, aspect_ratio,
       total_duration_sec, slots, edit_preset)
where not exists (
  select 1 from public.video_templates v
  where v.remotion_composition_id = t.remotion_composition_id
);
