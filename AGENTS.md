# Agent / Codex 專案指引

純前端本機桌面行程表（Vanilla HTML/CSS/JS，免安裝，`file://` 雙擊 `index.html` 即可用）。
正式站：https://calendar88.pages.dev/（Cloudflare Pages，push main 自動部署）。

**先讀** `AI_CONTEXT/PROJECT_BRIEF.md`（事實清單）→ `AI_CONTEXT/NOTES.md`（踩坑鐵則）→
`AI_CONTEXT/RECENT_CHANGES.md`（最近異動）；功能規劃/施工進度見 `ROADMAP.md`。

## 紅線

1. 不引框架、不 npm、不 build。
2. 新增資料欄位必同步更新 `normalizeStoredData()` / `buildBackupPayload()` / `applyBackupObject()` / `README.md`。
3. 行程完成用 `completedDates`；重複行程判斷唯一入口 `occursOnDate(task, dateKey)`。
4. 改動 `service-worker.js` 的 `APP_SHELL` 內任一檔案，必同步升 `CACHE_NAME`。
5. **UI 版面異動（桌機/手機）絕不隨意更動**：即使下令「實作」，也要先本機預覽/截圖給使用者確認，才可 push、部署。
6. `git add` 一律具名檔案，不用 `git add -A` / `git add .`。
7. 回覆繁體中文，簡短直接。

## 驗證方式

瀏覽器重新整理後手動測：新增/編輯行程、完成勾選、日/週/月切換、今日待辦模式、小工具模式、備份/還原。

## 觸發短語

- **存檔**：更新 `AI_CONTEXT/RECENT_CHANGES.md`（必要時 `NOTES.md`/`PROJECT_BRIEF.md`），不 push、不部署。
- **推送**：`git status` 確認 → 具名 `git add` → commit → push（觸發 Cloudflare 自動部署）。
- **存新版**：建立世代快照，永久保留、絕不覆蓋舊代。步驟：
  1. 讀 `versions/` 底下既有最大編號，新資料夾 `versions/行事曆-NNN/`（三位數遞增，如 002、003）。
  2. 複製核心程式檔（見下方清單）＋一份 `VERSION.md`（簡述這代新增了什麼）。
  3. 具名 `git add versions/行事曆-NNN/` → commit → push（此短語**會**推送，跟「存檔」不同）。
  - 核心程式檔清單：`index.html` `styles.css` `app.js` `sync.js` `config.js` `config.example.js` `push.js` `manifest.json` `service-worker.js` `icons/` `schema*.sql` `supabase/` `start-pwa-local.bat` `README.md` `CLOUD_SETUP.md` `CLOUD_PUSH_SETUP.md`。**不含** `AI_CONTEXT/`、`ROADMAP.md`、`CLAUDE.md`、`AGENTS.md`、`tests.html`（開發文件只在根目錄維護一份，不隨版本重複）。
