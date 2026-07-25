-- ============================================================
-- 種子影片樣板 x3(方案 C+D)
-- 以 name 判斷是否已存在,重複執行不會塞入重複資料
-- ============================================================

-- 樣板 A「作品前後對比」(9:16, 15 秒, 4 槽位)
insert into public.video_templates
  (name, description, remotion_composition_id, aspect_ratio, total_duration_sec, slots)
select
  '作品前後對比',
  '經典的 Before/After 呈現:環境、施作前、過程、成品,15 秒說完一個作品故事。',
  'BeforeAfterCompare',
  '9:16',
  15,
  '[
    {
      "slot_id": "s1",
      "name": "工作空間全景",
      "instruction": "請拍攝你的工作區域全景,鏡頭保持穩定,展示整體環境",
      "duration_sec": 3,
      "shot_type": "wide",
      "composition_hint": "工作桌/美容椅置於畫面中央",
      "validation": { "min_duration": 3, "required_content": "工作區域、桌面或美容椅", "brightness_check": true }
    },
    {
      "slot_id": "s2",
      "name": "施作前特寫",
      "instruction": "請拍攝客人施作前的部位特寫(如指甲、臉部、頭髮),光線充足,畫面穩定",
      "duration_sec": 3,
      "shot_type": "close-up",
      "composition_hint": "施作部位佔據畫面 70% 以上",
      "validation": { "min_duration": 3, "required_content": "施作前的手部、臉部或頭髮特寫", "brightness_check": true }
    },
    {
      "slot_id": "s3",
      "name": "施作過程",
      "instruction": "請拍攝你正在施作的手部操作過程,展現專業技術",
      "duration_sec": 5,
      "shot_type": "close-up",
      "composition_hint": "雙手和工具佔據畫面主體,背景簡潔",
      "validation": { "min_duration": 4, "required_content": "手部操作、美容工具使用過程", "brightness_check": true }
    },
    {
      "slot_id": "s4",
      "name": "完成品特寫",
      "instruction": "請拍攝完成後的成品特寫,可緩慢移動鏡頭展示細節",
      "duration_sec": 4,
      "shot_type": "close-up",
      "composition_hint": "成品居中,光線明亮,背景乾淨",
      "validation": { "min_duration": 3, "required_content": "完成後的美容成品", "brightness_check": true }
    }
  ]'::jsonb
where not exists (
  select 1 from public.video_templates where name = '作品前後對比'
);

-- 樣板 B「服務流程紀錄」(9:16, 21 秒, 5 槽位)
insert into public.video_templates
  (name, description, remotion_composition_id, aspect_ratio, total_duration_sec, slots)
select
  '服務流程紀錄',
  '從迎賓到成品的完整服務故事,適合展現專業感與服務溫度,21 秒。',
  'ServiceJourney',
  '9:16',
  21,
  '[
    {
      "slot_id": "s1",
      "name": "迎賓畫面",
      "instruction": "請拍攝客人走進店裡或入座的畫面,鏡頭固定,自然捕捉動作即可",
      "duration_sec": 3,
      "shot_type": "wide",
      "composition_hint": "門口或座位區置於畫面中央,左右保留空間",
      "validation": { "min_duration": 3, "required_content": "客人進門或入座的場景", "brightness_check": true }
    },
    {
      "slot_id": "s2",
      "name": "諮詢對話",
      "instruction": "請拍攝你與客人討論需求的互動畫面,拍側面即可,不需要收音",
      "duration_sec": 4,
      "shot_type": "medium",
      "composition_hint": "兩人同框,表情或手勢清楚可見",
      "validation": { "min_duration": 3, "required_content": "兩人諮詢互動的畫面", "brightness_check": true }
    },
    {
      "slot_id": "s3",
      "name": "施作過程 A",
      "instruction": "請拍攝第一個施作步驟的近距離畫面,手部動作清楚",
      "duration_sec": 5,
      "shot_type": "close-up",
      "composition_hint": "雙手與工具佔畫面主體,背景簡潔",
      "validation": { "min_duration": 4, "required_content": "手部施作動作", "brightness_check": true }
    },
    {
      "slot_id": "s4",
      "name": "施作過程 B",
      "instruction": "請從不同角度拍攝另一個施作步驟,和上一段做出變化",
      "duration_sec": 5,
      "shot_type": "close-up",
      "composition_hint": "換角度或換步驟,避免與前一段畫面雷同",
      "validation": { "min_duration": 4, "required_content": "手部施作動作(不同角度或步驟)", "brightness_check": true }
    },
    {
      "slot_id": "s5",
      "name": "成品與笑容",
      "instruction": "請拍攝完成後的成品,最好帶到客人滿意的表情",
      "duration_sec": 4,
      "shot_type": "medium",
      "composition_hint": "成品清楚,若客人入鏡以半身為主",
      "validation": { "min_duration": 3, "required_content": "完成的成品,可包含客人滿意的表情", "brightness_check": true }
    }
  ]'::jsonb
where not exists (
  select 1 from public.video_templates where name = '服務流程紀錄'
);

-- 樣板 C「3D 列印開箱」(9:16, 18 秒, 4 槽位)
insert into public.video_templates
  (name, description, remotion_composition_id, aspect_ratio, total_duration_sec, slots)
select
  '3D 列印開箱',
  '從列印到成品亮相的開箱敘事,適合客製作品的製作過程展示,18 秒。',
  'PrintUnboxing',
  '9:16',
  18,
  '[
    {
      "slot_id": "s1",
      "name": "印表機運作",
      "instruction": "請拍攝 3D 列印機正在列印的畫面,可以使用縮時攝影",
      "duration_sec": 5,
      "shot_type": "medium",
      "composition_hint": "列印平台與噴頭置於畫面中央",
      "validation": { "min_duration": 4, "required_content": "3D 列印機運作中的畫面", "brightness_check": true }
    },
    {
      "slot_id": "s2",
      "name": "取件瞬間",
      "instruction": "請拍攝從列印平台取下成品的動作,一氣呵成",
      "duration_sec": 4,
      "shot_type": "close-up",
      "composition_hint": "雙手與成品佔畫面主體",
      "validation": { "min_duration": 3, "required_content": "從列印平台取下成品的動作", "brightness_check": true }
    },
    {
      "slot_id": "s3",
      "name": "成品 360 度",
      "instruction": "請手持成品緩慢旋轉一圈,展示各角度細節",
      "duration_sec": 5,
      "shot_type": "close-up",
      "composition_hint": "成品置中,背景乾淨,轉動放慢",
      "validation": { "min_duration": 4, "required_content": "成品多角度展示", "brightness_check": true }
    },
    {
      "slot_id": "s4",
      "name": "應用場景",
      "instruction": "請把成品放在實際使用的場景中拍攝(桌面擺飾、櫃位陳列或配戴使用)",
      "duration_sec": 4,
      "shot_type": "medium",
      "composition_hint": "成品融入場景,畫面有生活感",
      "validation": { "min_duration": 3, "required_content": "成品在實際使用場景中的畫面", "brightness_check": true }
    }
  ]'::jsonb
where not exists (
  select 1 from public.video_templates where name = '3D 列印開箱'
);
