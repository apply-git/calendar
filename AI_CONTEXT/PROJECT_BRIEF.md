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
| `index.html` / `styles.css` | 主體頁面與樣式 |
| `app-01-core.js`～`app-09-entry.js` | 002 世代把原單檔 `app.js` 依頂層宣告邊界純搬移拆成九檔，循序載入、共用同一全域作用域。關鍵函式落點：`saveJson()`＝01；`render()`＝04；備份單一真相 `buildBackupPayload()`/`applyBackupObject()`＋AES-GCM 加密備份 `encryptBackupJson()`/`decryptBackupJson()`＝07；資料層 `normalizeStoredData()`/`occursOnDate()`/`replaceGcalTasks()`/`habitStreak()`、逐筆同步時間戳/墓碑 `touchTask()`/`tombstoneTask()`＝08；`window.CalendarApp` 介面（供 `sync.js` 用）＝09 |
| `gcal.js` | G1 Google 日曆唯讀匯入：權杖／區間／Calendar API events.list／活動→行程對應；寫入 tasks 唯一入口 `replaceGcalTasks()`（在 app-08） |
| `sync.js` / `config.js` | 雲端同步（pull→merge→push 逐筆合併 `mergeBackupPayloads()`，含家庭共享 `syncSharedTasks()`），未設定 config 時整個 no-op |
| `push.js` | 背景推播訂閱 UI，`webPushPublicKey` 空值時零影響 |
| `schema.sql` / `schema-history.sql` / `schema-share.sql` / `schema-push.sql` / `schema-errorlog.sql` | 依序對應：個人同步／備份版本／家庭共享／推播／錯誤上報(S4，選用)的 Supabase 表 |
| `CLOUD_SETUP.md` / `CLOUD_PUSH_SETUP.md` / `CLOUD_GCAL_SETUP.md` | 雲端功能設定教學（同步／推播／Google 日曆匯入） |
| `manifest.json` / `service-worker.js` / `icons/` / `start-pwa-local.bat` / `start-pwa-lan.bat` / `_lan_server.py` | PWA；`CACHE_NAME` 見 `service-worker.js` 開頭；`start-pwa-lan.bat`＋`_lan_server.py`＝區網預覽伺服器（送 no-store 標頭，供手機測非安全來源功能） |
| `tests.html` | 測試跑道，80 案例，開發用，不進 APP_SHELL |
| `guide.html` | 完整使用教學頁。進入先出**平台選擇**（💻電腦版／📱手機版），選定後顯示該軌九章（`#trackDesktop` `d-ch1~9`／`#trackMobile` `m-ch1~9`），頂部可隨時切換、目錄與頁首標題跟著切。每章＝說明＋一張擬真介面圖（桌機套瀏覽器視窗外框、手機套手機外框）＋**紅圈/紅色引線/紅字標註**（`--anno` 變數，深淺色各一值）＋figcaption＋實際範例。另有**可拖曳的浮動返回鈕** `#floatBack`（Pointer Events、6px 位移門檻分辨點擊/拖曳、位置存 `desktop-schedule-guide-backpos` 並 clamp 進視窗）。**自我包含**：樣式與插圖全內嵌、零外連，`file://` 可直接開；沿用 styles.css 的 CSS 變數並讀 `desktop-schedule-theme-v1` 跟隨深淺色。在 APP_SHELL 內（離線可查） |
| `_redirects` | Cloudflare Pages 專用：把開發文件路徑（CLAUDE/AGENTS/ROADMAP/AI_CONTEXT/versions/supabase/schema*/CLOUD_*/bat/py/config.example.js）302 導回首頁，避免整包 repo 被部署後可從正式站直接讀取。**絕不可把 APP_SHELL 檔案列進去** |
| `ROADMAP.md` | 功能規劃與逐波施工進度（checkbox 格式，本身即變更歷史，不需另建 changelog） |
| `README.md` | 使用者說明文件（面向終端使用者，非 agent context） |

## localStorage / IndexedDB keys

`desktop-schedule-v1`(行程) `-habits-v1` `-theme-v1` `-categories-v1` `-text-settings-v1`
`-app-settings-v1` `-daily-memos-v1` `-templates-v1` `-weekly-goals-v1` `-widget-mode-v1` `-okrs-v1`（P3 目標 OKR）
`-gcal-v1`（G1 Google 日曆匯入：provider_token／區間偏好／上次匯入時間，**憑證性質不進備份 JSON**）

不進備份（帳號/裝置本機狀態）：`-sync-auth-v1` `-sync-meta-v1` `-share-v1` `-errorlog-v1` `-weather-v1` `-holidays-v1` `-snooze-v1` `-welcome-v1`（歡迎教學卡片「不再顯示」旗標） `-guide-platform-v1`／實際 key `desktop-schedule-guide-platform`（教學頁上次選的電腦版/手機版） `desktop-schedule-guide-backpos`（教學頁浮動返回鈕位置）

IndexedDB `desktop-schedule-attachments`：附件 blob，不進備份、不進雲端
