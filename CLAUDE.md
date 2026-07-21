# Claude Code 專案指引

請先讀 `HANDOFF.md`。

## 專案摘要

這是 `d:\計畫表` 的純前端本機桌面行程表。

- 技術：Vanilla HTML / CSS / JavaScript
- 執行：雙擊 `index.html`（基本功能）
- 不需要 npm、不需要 build
- 資料存在瀏覽器 `localStorage`
- 已加入 PWA（安裝/離線）與雲端同步 scaffold（Supabase）：**這兩者需透過 `start-pwa-local.bat` 本機伺服器開啟**才會啟用；`file://` 雙擊仍可用全部本機功能。雲端同步預設停用（`config.js` 空值時零網路請求）。
- 功能規劃與分工進度見 `ROADMAP.md`。

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
- `app.js`（含 `window.CalendarApp` 介面供 `sync.js` 使用；備份格式單一真相為 `buildBackupPayload()` / `applyBackupObject()`）
- `sync.js` / `config.js` / `config.example.js` / `schema.sql` / `CLOUD_SETUP.md`（雲端同步 scaffold）
- `manifest.json` / `service-worker.js` / `icons/` / `start-pwa-local.bat`（PWA）
- `README.md`
- `HANDOFF.md`
- `ROADMAP.md`
- `AGENTS.md`
