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
- `app.js`：核心邏輯（`window.CalendarApp` 介面供 `sync.js`；備份單一真相 `buildBackupPayload()` / `applyBackupObject()`；逐筆同步時間戳/墓碑 `touchTask()`/`tombstoneTask()`；附件 IndexedDB 存取層）
- `sync.js`：雲端同步（Supabase，純 fetch，未設定時 no-op），已改為 pull→merge→push 逐筆合併（`mergeBackupPayloads()`），並含家庭共享同步 `syncSharedTasks()`
- `config.js` / `schema.sql`（個人同步）／`schema-history.sql`（備份版本）／`schema-share.sql`（家庭共享）／`schema-push.sql`＋Edge Function（背景推播）
- `CLOUD_SETUP.md` / `CLOUD_PUSH_SETUP.md`：雲端功能設定教學
- `push.js`：背景推播訂閱 UI（選用，零設定零影響）
- `manifest.json` / `service-worker.js` / `icons/` / `start-pwa-local.bat`：PWA（正式站已上線，本機伺服器僅供無網路情境；改 `APP_SHELL` 內檔案須同步升 `CACHE_NAME`）
- `tests.html`：測試跑道，48 案例，開發用
