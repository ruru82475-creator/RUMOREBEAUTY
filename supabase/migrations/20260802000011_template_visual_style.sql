-- ============================================================
-- 模板的預設視覺風格
-- 選了模板 → 濾鏡 + 裝飾 + 字幕風格 + 配樂氛圍一次配好
--
-- decoration     對應 src/lib/resources/decorations.ts 的 id
-- subtitle_style 對應 src/lib/resources/subtitleStyles.ts 的 id
-- effect         對應 src/lib/resources/filters.ts 的 id
--                (舊值 mono 已由程式自動對到新的 noir「黑金」)
-- ============================================================

update public.video_templates
set edit_preset = edit_preset || jsonb_build_object(
  'effect',         s.effect,
  'decoration',     s.decoration,
  'subtitle_style', s.subtitle_style
)
from (values
  ('StyleCream',     'cream',      'frame-elegant',    'elegant-serif'),
  ('StylePorcelain', 'porcelain',  'frame-minimal',    'classic-white'),
  ('StylePeach',     'peach',      'none',             'pop-in'),
  ('StyleAiry',      'airy',       'gradient-overlay', 'minimal'),
  ('StyleRetro',     'retro',      'floral',           'magazine'),
  ('StyleMuted',     'muted',      'frame-minimal',    'outline-only'),
  ('StyleTimelapse', 'cream',      'none',             'bold-impact'),
  ('StyleMono',      'noir',       'gold-swirls',      'elegant-serif')
) as s(composition_id, effect, decoration, subtitle_style)
where public.video_templates.remotion_composition_id = s.composition_id;

-- 舊專案沒有這兩個欄位,補上預設值,編輯頁開啟時才不會是空的
update public.edit_projects
set edit_config = edit_config
  || jsonb_build_object('decoration', coalesce(edit_config ->> 'decoration', 'none'))
  || jsonb_build_object(
       'subtitle_style',
       coalesce(edit_config ->> 'subtitle_style', 'classic-white')
     )
where edit_config is not null
  and (edit_config ->> 'decoration' is null
       or edit_config ->> 'subtitle_style' is null);
