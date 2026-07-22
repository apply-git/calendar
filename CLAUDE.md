# Claude Code 專案指引

請先讀 `HANDOFF.md`。

## 專案摘要

這是 `d:\計畫表` 的純前端本機桌面行程表。

- 技術：Vanilla HTML / CSS / JavaScript
- 執行：雙擊 `index.html`（基本功能）
- 不需要 npm、不需要 build
- 資料存在瀏覽器 `localStorage`
- PWA（安裝/離線）與雲端同步（Supabase，含逐筆合併同步、雲端備份版本、家庭共享、背景推播）皆已正式上線：https://calendar88.pages.dev/ （Cloudflare Pages，git push main 自動部署）。本機 `start-pwa-local.bat` 僅供無網路區網情境；`file://` 雙擊仍可用全部本機功能，雲端相關功能未設定 `config.js` 時零網路請求。
- 功能規劃與分工進度見 `ROADMAP.md`；完整交接內容見 `HANDOFF.md`。

## 工作規則

1. 優先保持免安裝、純前端。
2. 不要任意引入框架或打包工具。
3. 新增資料欄位時同步更新：
   - `normalizeStoredData()`
   - `exportBackup()`
   - `importBackup()`
   - `README.md`
   - `HANDOFF.md`
4. 行程完成狀態使用 `completedDates`。
5. 重複行程使用 `occursOnDate(task, dateKey)` 判斷。
6. 修改後用瀏覽器重新整理 `index.html` 手動驗證。
7. 回覆使用繁體中文，簡短直接。
8. 使用者說「存檔」時，同步更新 `HANDOFF.md`、`CLAUDE.md`、`AGENTS.md`。

## 主要檔案

- `index.html`
- `styles.css`
- `app.js`（含 `window.CalendarApp` 介面供 `sync.js` 使用；備份格式單一真相為 `buildBackupPayload()` / `applyBackupObject()`；task 逐筆時間戳/墓碑見 `touchTask()`/`tombstoneTask()`；IndexedDB 附件存取層見 `idbPut()` 等）
- `sync.js`（雲端同步，pull→merge→push 逐筆合併，`mergeBackupPayloads()`；含家庭共享 `syncSharedTasks()`）／`config.js` / `config.example.js`
- `schema.sql`（個人同步）／`schema-history.sql`（雲端備份版本）／`schema-share.sql`（家庭共享）／`schema-push.sql`＋`supabase/functions/send-reminders/`（背景推播）
- `CLOUD_SETUP.md`（雲端同步/備份版本/家庭共享設定教學）／`CLOUD_PUSH_SETUP.md`（背景推播部署教學）
- `push.js`（背景推播訂閱 UI，`webPushPublicKey` 空值時零影響）
- `manifest.json` / `service-worker.js` / `icons/` / `start-pwa-local.bat`（PWA；`CACHE_NAME` 版本號見檔案開頭，改動 `APP_SHELL` 內任何檔案必須同步升版）
- `tests.html`（純前端測試跑道，48 案例，開發用，不進 `APP_SHELL`）
- `README.md`
- `HANDOFF.md`
- `ROADMAP.md`
- `AGENTS.md`
