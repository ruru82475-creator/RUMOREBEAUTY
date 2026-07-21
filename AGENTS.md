# AGENTS.md

本專案的 AI 助手工作準則:

1. **先讀 [CLAUDE.md](./CLAUDE.md)** — 專案憲法,所有鐵律必須遵守(繁中 UI、mobile-first、RLS、migration 流程、build 驗證等)。
2. **再讀 [HANDOVER.md](./HANDOVER.md)** — 專案現況交接:已完成功能、資料庫狀態、部署流程、已知問題、待辦 roadmap。
3. 業主是程式新手:所有給業主的說明用繁體中文(台灣用語)、白話、逐步。
4. commit 前必跑 `git status --short` 檢查非預期檔案(嚴防憑證 txt 入版控;此 repo 是公開的)。
5. 每個功能完成必須 `npm run build` 通過才算完成;push main 即自動部署到 Vercel 正式站。
