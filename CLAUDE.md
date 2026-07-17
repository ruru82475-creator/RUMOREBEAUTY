# GlowStudio 專案憲法

## 產品定位
美容產業創作者的個人品牌官網 + CRM + AI 引導式影片剪輯 + 社群一鍵發布 PWA。
使用者角色分兩種:creator(創作者/美容師,即站主)與 client(客戶)。

## 鐵律
1. 所有 UI 文字使用繁體中文(台灣用語)。
2. 手機優先(mobile-first),所有頁面必須在 390px 寬度下完美呈現。
3. 所有金鑰只存在 .env.local,程式碼中一律用環境變數,絕不硬編碼。
4. 所有資料表必須啟用 Supabase RLS(Row Level Security),client 只能讀寫自己的資料。
5. 所有表單用 react-hook-form + zod 驗證,錯誤訊息繁體中文。
6. 影片檔案一律走 R2 預簽名 URL 直傳,絕不經過 Next.js server 中轉。
7. 動效原則:首頁可華麗(GSAP),功能頁必須克制(Framer Motion 微動效),任何動效不得阻礙操作。
8. 設計系統:深色為主色調,單一品牌強調色(預設玫瑰金 #B76E79,可由創作者後台更換),大量留白,字體 Noto Sans TC + 標題可用 serif 對比。目標是媲美 Awwwards 得獎網站的質感,但不犧牲載入速度(LCP < 2.5s)。
9. 每完成一個功能,必須先在本地跑過 npm run build 確認無錯誤才算完成。
10. 資料庫 schema 變更一律寫成 SQL migration 檔存放於 supabase/migrations,不直接在 Dashboard 改。

## 影片管線核心概念(方案 C + D)
- 樣板(Template)= Remotion React 元件 + 槽位定義 JSON(slots)。
- 槽位(Slot)= 一段需要使用者拍攝的素材規格:{ id, 名稱, 拍攝指令, 秒數, 景別, 構圖提示, 驗證規則 }。
- 流程:選樣板 → AI 逐槽引導拍攝 → 上傳 → Claude API 抽幀驗證 → 全部合格 → Remotion Lambda 渲染 → 成品入庫 → 一鍵發布。
