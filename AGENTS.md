# Agent / Codex 專案指引

請先讀 `HANDOFF.md`。

## 專案

`d:\計畫表` 是純前端本機行程表。

## 技術

- HTML
- CSS
- Vanilla JavaScript
- localStorage
- 無 npm
- 無 build step

## 執行方式

直接開啟：

`index.html`

## 開發原則

- 保持簡單，不引入框架或打包工具（PWA / 雲端同步都用原生 API 與 fetch）。
- 修改前先理解 `app.js` 的全域狀態與 `render()` 流程。
- 新資料欄位必須相容舊 localStorage。
- 備份 / 還原功能要同步支援新欄位（走 `buildBackupPayload()` / `applyBackupObject()`）。
- 文件要同步更新 `README.md`、`HANDOFF.md` 與 `ROADMAP.md`。
- 使用者說「存檔」時，同步更新 `HANDOFF.md`、`CLAUDE.md`、`AGENTS.md`。

## 驗證方式

瀏覽器重新整理後手動測：

1. 新增行程
2. 編輯行程
3. 完成勾選
4. 日 / 週 / 月切換
5. 今日待辦模式
6. 小工具模式
7. 備份 / 還原

## 重要檔案

- `HANDOFF.md`：完整交接
- `ROADMAP.md`：功能規劃、分工與進度
- `README.md`：使用說明
- `index.html`：UI 結構
- `styles.css`：樣式
- `app.js`：核心邏輯（`window.CalendarApp` 介面供 `sync.js`；備份單一真相 `buildBackupPayload()` / `applyBackupObject()`）
- `sync.js` / `config.js` / `schema.sql` / `CLOUD_SETUP.md`：雲端同步 scaffold（Supabase，純 fetch，未設定時 no-op）
- `manifest.json` / `service-worker.js` / `icons/` / `start-pwa-local.bat`：PWA（需本機伺服器）
