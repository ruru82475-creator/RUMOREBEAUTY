# GlowStudio(RUMOREBEAUTY)專案交接文件

> 最後更新:2026-07-19。本文件為 AI 助手交接用,記錄專案從初始化至今的全部工作成果與待辦。
> **開發前必讀 [CLAUDE.md](./CLAUDE.md)(專案憲法),所有鐵律必須遵守。**

---

## 1. 專案概述

- **產品**:美容產業創作者(站主)的個人品牌官網 + CRM + AI 引導式影片剪輯 + 社群一鍵發布 PWA
- **角色**:`creator`(站主,唯一)與 `client`(客戶)
- **業主**:美業 + 3D 列印雙棲創作者,**程式新手**——說明要白話、逐步、繁體中文(台灣用語)

## 2. 重要連結與帳號

| 項目 | 值 |
|---|---|
| 正式站 | https://rumorebeauty-w285.vercel.app |
| GitHub repo(公開) | https://github.com/ruru82475-creator/RUMOREBEAUTY(分支 `main`) |
| 本機專案路徑 | `C:\Users\ruru8\網站製作\glow-studio` |
| Supabase 專案 ref | `amjvjkgrepolagloswmb`(org:ruru82475-creator's Org,專案名「美業3d網站」) |
| Vercel | 帳號以 ruru82475-creator 的 GitHub 登入;push main 即自動部署 |
| 站主帳號 | ruru82475@gmail.com(role=creator,唯一站主;rick80251@gmail.com 為 client) |
| 本機 git 推送身分 | gh CLI 登入 rick80251-art(是 repo 協作者) |

## 3. 技術棧

Next.js **15.5**(App Router + Turbopack)+ TypeScript + Tailwind **v4** + Supabase(`@supabase/ssr`)+ framer-motion 12 + GSAP 3.15 + react-hook-form + zod **v4** + lucide-react + next-pwa(**未啟用**,見已知問題)。

字體:Noto Sans TC(內文)+ Noto Serif TC(標題),`next/font` 載入。
設計:深色底 `#0d0b0e`,品牌色 CSS 變數 `--brand`(預設玫瑰金 `#B76E79`,可由 profiles.brand_color 覆寫,首頁已實作覆寫)。

## 4. 已完成功能

### 4.1 認證系統
- `/login`:Email magic link + Google OAuth(皆實測通過)
- `/auth/callback`(PKCE code 交換)、`/auth/confirm`(token_hash)、`/auth/signout`
- **第一個註冊帳號自動成為 creator**,其餘 client(DB trigger `handle_new_user` + advisory lock)
- 角色保護:middleware(`src/middleware.ts` + `src/lib/supabase/middleware.ts`)攔 `/studio` 前綴;`(studio)/studio/layout.tsx` 第二層驗證;非 creator 導回 `/?notice=studio_only` 顯示「此區僅限站主使用」
- 使用者選單:`src/components/ui/site-header.tsx` + `user-menu.tsx`(頭像/名稱/角色連結/登出)
- Supabase client 三件組:`src/lib/supabase/client.ts`(瀏覽器)、`server.ts`(伺服器,async cookies)、`admin.ts`(service role,`import "server-only"` 防前端打包)

### 4.2 對外形象首頁 `(public)/page.tsx`
七區塊:Hero(GSAP 逐字浮現+滑鼠視差,桌機限定;有精選影片時自動改影片背景)→ 關於(取最早建立的 creator profile)→ 精選作品(GSAP ScrollTrigger 橫向捲動,手機/reduced-motion 降級原生滑動)→ 服務項目(TiltCard 微傾斜)→ 客戶好評(**假資料佔位**)→ CTA(profiles.line_url 有值才顯示「預約諮詢」按鈕)→ Footer(profiles 五個社群連結欄位,有值才顯示)。
動效元件:`src/components/motion/`(hero / reveal / horizontal-gallery / tilt-card)。

### 4.3 作品集
- 公開頁 `/works/beauty`、`/works/3dprint`(動態路由 `(public)/works/[category]`):瀑布流(CSS columns)+ tags 篩選 + stagger 進場 + 全螢幕 Lightbox(自訂影片播放器:進度條/靜音/全螢幕/ESC)
- view_count:首播 +1,走 RPC `increment_view_count`,sessionStorage 同 session 去重
- 後台 `/studio/works`:CRUD(server actions + zod)、framer-motion Reorder 拖曳排序(更新 sort_order)、發布開關、上傳(**目前 Supabase Storage bucket `portfolio`,單檔 50MB;規劃換 R2 直傳,上傳邏輯集中在 works-manager.tsx 的 UploadField 元件**)

### 4.4 客戶端 `/account`
客戶編輯自己的聯絡資料+通知偏好;首次進入以已驗證 email 自動綁定站主建立的 clients 列(admin client 執行)。

## 5. 資料庫(Supabase)

### 5.1 Migrations(`supabase/migrations/`,**皆已在正式庫執行**)
1. `20260717000001_init_schema.sql` — 7 張表全開 RLS:profiles / portfolio_items / clients / notifications / video_templates / edit_projects / social_posts;`is_creator()` helper;防角色自升 trigger;handle_new_user trigger
2. `20260717000002_auth_first_creator.sql` — 首位註冊者=creator;放寬客戶可自編聯絡欄位(trigger 仍鎖 creator_id/auth_user_id/notes/tags/last_visit_at/created_at)
3. `20260718000003_profile_social_links.sql` — profiles 加 line_url / instagram_url / facebook_url / threads_url / youtube_url
4. `20260718000004_works_view_count_storage.sql` — increment_view_count RPC;storage bucket `portfolio` + 政策(公開讀/creator 寫)

### 5.2 RLS 原則(不可破壞)
- creator 完全存取自己 creator_id 的資料;寫入 with check 併驗 `is_creator()`
- client 僅能讀寫 clients 表自己那列的聯絡+通知欄位(trigger 管欄位)
- portfolio_items `is_published=true` 允許匿名讀;video_templates 已登入可讀,寫入僅 service role
- **改角色只能用 service role**(API 呼叫;Dashboard SQL/Table Editor 直改會被 trigger 擋,因 auth.jwt() 為空。慣用作法:專案根目錄寫一次性 .cjs 腳本用 admin client 執行後即刪)

### 5.3 慣例
- **schema 變更一律寫 migration 檔**,不直接改 Dashboard(鐵律 10)
- 業主自己到 Supabase SQL Editor 貼上執行(新手,給他完整 SQL 與白話步驟)。歷史 SQL 集中在 Claude artifact 頁(業主有書籤);opencode 接手後改附完整 SQL 給業主即可

## 6. 環境變數

`.env.local`(本機,已在 .gitignore;範本見 `.env.local.example`):
- 已填:`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`(Vercel 上同樣已設定這三個)
- 未填(功能未做):ANTHROPIC_API_KEY、R2_*(4 個)、REMOTION_AWS_*(2 個)、RESEND_API_KEY、LINE_*(2 個)、SMS_*(2 個)、AYRSHARE_API_KEY

## 7. 開發/部署流程

```bash
npm run dev     # 本機 http://localhost:3000(埠被占時注意別跟其他專案衝突)
npm run build   # 鐵律 9:每個功能完成必須先本機 build 通過
git push        # 推 main → Vercel 自動部署 1~2 分鐘
```

- Supabase Auth URL 設定:Site URL = 正式站;Redirect URLs 含 `http://localhost:3000/auth/callback` 與 `https://rumorebeauty-w285.vercel.app/auth/callback`
- Google OAuth 憑證在業主的 Google Cloud 專案「Rumorebarty」,redirect URI 指向 supabase.co,新網域**不需**改 Google 端

## 8. 已知問題與注意事項

1. **⚠️ commit 前必跑 `git status --short`**:業主會把密碼記在中文檔名 .txt 放專案資料夾(已發生過 DB 密碼被推上公開 repo 的事故,已 force push 清除+要求重設密碼)。.gitignore 已加 `*密碼*.txt`,但仍要警覺任何非預期檔案
2. next-pwa 5.6 太舊且不支援 Turbopack,**尚未接線**;要做 PWA 時改用 `@ducanh2912/next-pwa` 或 Serwist
3. Email 信件模板仍是英文:Supabase 免費內建 SMTP 每小時限 2~4 封,需設 Resend SMTP 後才能改繁中模板
4. 首頁「關於/品牌」資料取 `role='creator'` 中 created_at 最早的一筆;目前唯一 creator 是 ruru82475@gmail.com
5. (studio) route group 不出現在 URL:後台頁面一律放 `src/app/(studio)/studio/` 下(URL `/studio/...`),middleware 才攔得到
6. 客戶好評區是寫死的假資料(`(public)/page.tsx` 的 TESTIMONIALS)
7. Windows 環境;路徑含中文;git 換行警告(LF→CRLF)無害

## 9. 待辦 Roadmap(照 CLAUDE.md 藍圖)

1. **客戶管理 CRM**(`/studio/clients`):clients 表 CRUD、標籤、備註、到訪紀錄;通知發送(notifications 表,接 Resend/LINE/SMS)
2. **影片工作室**(核心,方案 C+D,見 CLAUDE.md):video_templates(Remotion 元件+slots JSON)→ AI 逐槽引導拍攝 → 上傳 → Claude API 抽幀驗證 → Remotion Lambda 渲染 → edit_projects 入庫 → 一鍵發布
3. **R2 直傳**:預簽名 URL 直傳(鐵律 6:影片絕不過 Next.js server),替換 works-manager.tsx 的 UploadField
4. **社群發布**(social_posts + Ayrshare)
5. **後台設定頁**:讓站主自行編輯 display_name/bio/頭像/品牌色/LINE 與社群連結(目前只能在 Supabase Table Editor 手改 profiles)
6. **好評管理**:把假資料換成資料表
7. 自訂網域、Resend SMTP + 繁中信件模板、PWA

## 10. 給接手 AI 的叮嚀

- 業主是新手:給他的每個操作步驟都要具體到「點哪裡、貼什麼」;錯誤訊息要先翻譯成白話再給解法
- UI 文字、表單錯誤訊息一律繁體中文(台灣用語);手機 390px 優先
- 金鑰絕不硬編碼、絕不出現在 git;RLS 不可繞過(admin client 僅限伺服器端信任情境)
- 每個功能完成:`npm run build` 通過 → `git status` 檢查 → commit → push(自動部署)
