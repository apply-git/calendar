# Project Brief — 桌面行程表

- 專案位置：`d:\計畫表`
- 技術：Vanilla HTML/CSS/JS，無 npm、無 build，資料存瀏覽器 localStorage
- 正式站：https://calendar88.pages.dev/
- 原始碼倉庫：https://github.com/apply-git/calendar.git（push main 自動觸發 Cloudflare Pages 部署，Framework=None，輸出目錄 `/`）
- Supabase 專案：calendar-gogo（`uaentjtgdrzbzfkccybs.supabase.co`）——注意帳號別搞混，跟「房站AI助手」是不同 Supabase 帳號
- Supabase 用途：Google 登入、雲端同步(`sync_state`)、備份版本(`sync_history`)、家庭共享(`share_groups`/`share_members`/`shared_state`)、推播(`push_subscriptions`)
- 金鑰：`config.js` 的 `supabaseAnonKey`/`webPushPublicKey` 是公開金鑰、可進 git；service_role/VAPID 私鑰只在 Supabase Function Secrets，不進前端

## 主要檔案

| 檔案 | 用途 |
|---|---|
| `index.html` / `styles.css` / `app.js` | 主體。`app.js` 含 `window.CalendarApp` 介面供 `sync.js` 用；備份單一真相 `buildBackupPayload()`/`applyBackupObject()`；逐筆同步時間戳/墓碑 `touchTask()`/`tombstoneTask()`；附件 IndexedDB 存取層 `idbPut()` 等 |
| `sync.js` / `config.js` | 雲端同步（pull→merge→push 逐筆合併 `mergeBackupPayloads()`，含家庭共享 `syncSharedTasks()`），未設定 config 時整個 no-op |
| `push.js` | 背景推播訂閱 UI，`webPushPublicKey` 空值時零影響 |
| `schema.sql` / `schema-history.sql` / `schema-share.sql` / `schema-push.sql` | 依序對應：個人同步／備份版本／家庭共享／推播的 Supabase 表 |
| `CLOUD_SETUP.md` / `CLOUD_PUSH_SETUP.md` | 雲端功能設定教學 |
| `manifest.json` / `service-worker.js` / `icons/` / `start-pwa-local.bat` | PWA；`CACHE_NAME` 見 `service-worker.js` 開頭 |
| `tests.html` | 測試跑道，48 案例，開發用，不進 APP_SHELL |
| `ROADMAP.md` | 功能規劃與逐波施工進度（checkbox 格式，本身即變更歷史，不需另建 changelog） |
| `README.md` | 使用者說明文件（面向終端使用者，非 agent context） |

## localStorage / IndexedDB keys

`desktop-schedule-v1`(行程) `-habits-v1` `-theme-v1` `-categories-v1` `-text-settings-v1`
`-app-settings-v1` `-daily-memos-v1` `-templates-v1` `-weekly-goals-v1` `-widget-mode-v1`

不進備份（帳號/裝置本機狀態）：`-sync-auth-v1` `-sync-meta-v1` `-share-v1` `-errorlog-v1` `-weather-v1` `-holidays-v1` `-snooze-v1`

IndexedDB `desktop-schedule-attachments`：附件 blob，不進備份、不進雲端
