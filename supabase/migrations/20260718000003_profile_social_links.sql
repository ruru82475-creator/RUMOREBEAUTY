-- ============================================================
-- 首頁 CTA 與 Footer 需要的社群連結欄位(存於 creator 的 profile)
-- line_url:LINE 官方帳號加好友連結(首頁「預約諮詢」按鈕)
-- 其餘為 Footer 社群圖示連結,留空則不顯示該圖示
-- ============================================================

alter table public.profiles
  add column if not exists line_url text,
  add column if not exists instagram_url text,
  add column if not exists facebook_url text,
  add column if not exists threads_url text,
  add column if not exists youtube_url text;
