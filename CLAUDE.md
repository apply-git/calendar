# Claude Code 專案指引

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
7. 改動後手動驗：新增/編輯行程、完成勾選、日週月切換、備份還原。
8. 回覆繁體中文，簡短直接。

## 觸發短語

- **存檔**：更新 `AI_CONTEXT/RECENT_CHANGES.md`（必要時 `NOTES.md`/`PROJECT_BRIEF.md`），不 push、不部署。
- **推送**：`git status` 確認 → 具名 `git add` → commit → push（觸發 Cloudflare 自動部署）。
