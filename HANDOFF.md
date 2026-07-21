# 桌面行程表交接檔

## 專案位置

`d:\計畫表`

## 專案類型

純前端本機 App：Vanilla HTML / CSS / JavaScript。

不需要 npm、不需要 build、不需要伺服器。

使用方式：直接雙擊 `index.html`。

## 主要檔案

| 檔案 | 用途 |
|---|---|
| `index.html` | 主畫面與 dialog 結構 |
| `styles.css` | 版面、主題、手機響應式、小工具模式樣式 |
| `app.js` | 全部資料狀態、渲染、互動邏輯 |
| `sync.js` | 雲端同步 scaffold（Supabase REST/Auth，純 fetch，未設定時整個 no-op） |
| `config.js` | 雲端同步實際設定檔（`window.CALENDAR_SYNC_CONFIG`，預設空值） |
| `config.example.js` | 雲端同步設定範例／備份，不會被 index.html 載入 |
| `schema.sql` | Supabase `sync_state` 表 + RLS 規則，供 CLOUD_SETUP.md 步驟貼到 SQL Editor 執行 |
| `CLOUD_SETUP.md` | 雲端同步設定教學（建 Supabase 專案、跑 schema、設定 Google 登入） |
| `manifest.json` / `service-worker.js` / `icons/` / `start-pwa-local.bat` | PWA 安裝與離線快取（需本機伺服器）。`icons/` 內含正式圖示（icon-192/icon-512/icon-maskable-512/apple-touch-icon/favicon-64，皆圓角）與 `icon-master-1024.png` 母檔備用；`service-worker.js` 快取版本以檔案開頭 `CACHE_NAME` 為準（2026-07-19 查證為 v20，文件內提及的舊版號皆為歷史記錄）。 |
| `README.md` | 使用說明 |
| `HANDOFF.md` | 本交接檔 |
| `ROADMAP.md` | 功能規劃、分工與進度（2026-07 大幅擴充的依據） |
| `CLAUDE.md` | Claude Code 入口說明 |
| `AGENTS.md` | Codex / 通用 agent 入口說明 |

## 執行 / 驗證

1. 開啟：`index.html`
2. 瀏覽器網址類似：`file:///D:/%E8%A8%88%E7%95%AB%E8%A1%A8/index.html`
3. 修改後重新整理頁面即可。
4. 無自動測試；以瀏覽器手動測功能。

## 資料儲存

全部存在瀏覽器 `localStorage`。

目前使用 key：

- `desktop-schedule-v1`：行程
- `desktop-schedule-habits-v1`：習慣
- `desktop-schedule-theme-v1`：深色 / 淺色
- `desktop-schedule-categories-v1`：分類
- `desktop-schedule-text-settings-v1`：自訂文字
- `desktop-schedule-app-settings-v1`：工作時間等設定
- `desktop-schedule-daily-memos-v1`：每日備忘錄
- `desktop-schedule-templates-v1`：快速範本
- `desktop-schedule-weekly-goals-v1`：每週目標
- `desktop-schedule-widget-mode-v1`：小工具模式
- `desktop-schedule-sync-auth-v1`：雲端同步登入權杖（access/refresh token、使用者 id/email）。**不**納入「備份」匯出/還原，避免帳號憑證被包進分享出去的 JSON 檔。
- `desktop-schedule-sync-meta-v1`：雲端同步狀態（最後一次成功同步的時間戳）。同樣**不**納入備份。
- `desktop-schedule-errorlog-v1`：全域錯誤紀錄環形緩衝（最多 50 筆，僅 message/stack/UA/時間，無個資與 token）。**不**納入備份。
- `desktop-schedule-weather-v1`：Open-Meteo 天氣快取（3 小時 TTL，含座標與 7 日預報）。**不**納入備份。
- `desktop-schedule-holidays-v1`：台灣假日動態表快取（30 天 TTL，來源 ruyut/TaiwanCalendar CDN，查無 fallback 靜態 `TAIWAN_HOLIDAYS`）。**不**納入備份。

`appSettings`（`desktop-schedule-app-settings-v1`）新增欄位 `autoSync`（布林，預設 `false`）：是否開啟「存檔時自動同步到雲端」。這個欄位**有**跟著 `appSettings` 整包走 `normalizeStoredData()` / `exportBackup()` / `importBackup()`。

task 物件新增欄位 `excludedDates`（字串陣列，預設 `[]`）：儲存「這筆（通常是重複）行程被排除、不顯示」的日期字串清單，供「🗑 清空當日」功能使用。`occursOnDate(task, dateKey)` 一開始就會檢查 `excludedDates` 是否包含 `dateKey`，包含就直接回傳 `false`（蓋掉所有重複規則判斷）。`normalizeStoredData()` 會幫舊資料補上空陣列；`buildBackupPayload()` / `applyBackupObject()` 是整包序列化/還原 `tasks` 陣列，`excludedDates` 會自動跟著 task 物件走，不需要額外程式碼。

### 行程附件（IndexedDB，2026-07-22）

- 獨立資料庫：`desktop-schedule-attachments`（IndexedDB，version 1，objectStore `files`，keyPath `id`，`taskId` 建索引）。紀錄形狀：`{ id: 'att-'+隨機, taskId, name, type, size, blob, createdAt }`。附件本體（`blob`）**只存這個 IndexedDB**，不進 `localStorage`、不進 `buildBackupPayload()` 備份 JSON、不隨雲端同步（`sync.js` 完全不知道這個 DB 的存在）。
- 存取層（app.js）：`idbPut(record)` / `idbGetByTask(taskId)` / `idbDelete(id)` / `idbDeleteByTask(taskId)`，皆回傳 Promise，內部用 `openAttachmentDb()` 開單一共用連線。`attachmentsUnavailable`（模組層旗標）在 `initAttachmentFeature()`（`init()` 內、`normalizeStoredData()` 之後呼叫）偵測 `window.indexedDB` 不存在或開庫失敗時設為 `true`，並呼叫 `hideAttachmentUI()` 隱藏 `#attachmentSection`，其餘功能不受影響。
- task 物件新增欄位 `attachmentCount`（數字，預設 `0`）：只存「目前有幾個附件」供 `taskCard()` 顯示 `📎N` 徽章，附件本體不在這個欄位裡，會自動跟著 `tasks` 陣列走進備份/雲端（只是個數字，沒有隱私疑慮）。`normalizeStoredData()` 會幫舊資料補 `0`。新增行程尚未存檔時，附件先暫存在模組層 `pendingAttachments` 記憶體陣列，`saveTaskFromForm()` 存檔拿到 `task.id` 後才批次 `idbPut()` 寫入並設定 `attachmentCount`；取消新增（`closeTaskDialog()`）會捨棄 `pendingAttachments`。編輯既有行程時新增/刪除附件是「即點即寫」：直接呼叫 `idbPut()`/`idbDelete()`，同步更新該 task 的 `attachmentCount` 並 `touchTask()` + `saveJson()`。
- 刪除行程時清附件：所有「使用者刪除行程」路徑（卡片 🗑、對話框刪除、清空當日/週/月、清理舊行程）都會經過中央 helper `tombstoneTask()`，這裡已經一併呼叫 `idbDeleteByTask(task.id)`，不需要在各呼叫點個別處理。`normalizeStoredData()` 的墓碑 90 天到期清除（真的從 `tasks` 陣列移除，非 `tombstoneTask()` 路徑，可能是雲端同步/還原備份帶進來的舊墓碑）也順手呼叫 `idbDeleteByTask()`，避免留下孤兒附件。
- 複製到明天／重複行程「僅這次」「這次及之後」切割出的新 task（新 id）一律把 `attachmentCount` 重設為 `0`——附件實體仍留在原 task id 底下，新 id 沒有對應附件（已知限制，未做「連同複製附件」）。

## 已完成功能

- 手機版表頭調整（2026-07-17）：`setupMobilePanels()` 開頭把 `.sidebar .brand`（圖示＋標題＋今天日期）用 `insertBefore` 搬到 `.main` 最上方當表頭並加 `brand-mobile` class（CSS 縮小成精簡一列）；側欄的 `#quickAddBtn`（大顆＋新增行程）在手機用 CSS 隱藏，由右下角 FAB 取代。全部包在 760px matchMedia／media query 內，桌面版不受影響。
- 手機版排版大改（斷點 `max-width: 760px`，桌面版一像素都不受影響，所有規則都包在這個 media query 或 `matchMedia('(max-width: 760px)')` 判斷內）：`.app-shell` 在此斷點改 `display:flex;flex-direction:column`，`.main { order: 1 }`／`.sidebar { order: 2 }` 讓行事曆本體排到最前面，側邊欄排到後面。`app.js` 新增 `setupMobilePanels()`（在 `init()` 裡 `bindEvents()` 之後呼叫一次，只在 `matchMedia` 命中手機時才動作，不監聽 resize）：幫每個 `.sidebar .panel`、動態插入標題的 `.controls`（搜尋/篩選區）、`.daily-memo`（沿用既有 `.daily-memo-head` 當標題列）加上 `collapsible` class 與預設的 `collapsed` class，並在各自的標題列元素（統一加上 `panel-collapse-head` class）綁 click 切換 `collapsed`；CSS 用 `.panel.collapsible.collapsed > *:not(.panel-collapse-head) { display:none }` 隱藏內容，標題用 `::after` 顯示 ▸（收合）／▾（展開）。新增 `#fabAddBtn`（`.fab-add`，右下角圓形懸浮＋號）：桌面版 CSS 固定 `display:none`、HTML 帶 `hidden`，只有手機模式時 JS 移除 `hidden`、CSS 用 `.fab-add:not([hidden])` 才真的顯示（避免 CSS 蓋掉 `hidden` 屬性），click 呼叫既有的 `openTaskDialog()`。工具列新增 `#moreToolsBtn`（同樣預設 `hidden`，手機才顯示）與 `#moreToolsDialog`：手機上把次要工具鈕（🔔 開啟通知、備份、還原、文字設定、🍅 番茄鐘、小工具模式、清理舊行程、匯出 Excel/PDF/.ics、匯入 .ics）用 id 列舉 `display:none !important` 藏起來，改收進 `moreToolsDialog` 裡一排 `data-proxy="原按鈕id"` 的 proxy 按鈕，點下去先 `moreToolsDialog.close()` 再對原按鈕呼叫 `.click()`，不用搬動任何原有按鈕或邏輯。`dialog.task-dialog` 在此斷點改 `width:100%;margin:auto 0 0 0;border-radius:20px 20px 0 0;max-height:88vh;overflow-y:auto`，變成貼齊底部彈出、可捲動。`service-worker.js` 的 `CACHE_NAME` 因此從 `v13` 升到 `v14`。
- 年月日直選跳轉：導航列有 📅 按鈕（`#jumpDateBtn`）＋隱藏的 `<input type="date">`（`#jumpDateInput`，樣式 `.date-jump`）。支援 `showPicker()` 的瀏覽器會把輸入框加上 `.picker-hidden`（1px 透明、absolute，**不能用 display:none 否則 showPicker 會失效**），點 📅 或點日期標題（`#currentTitle`）開啟原生年月日選擇器；不支援的舊瀏覽器則反過來顯示小輸入框、隱藏 📅 按鈕。選定日期直接跳到該天（週/月檢視跳到含該日的週/月），`renderTitle()` 同步 `jumpDateInput.value`。行程視窗的日期欄（`#taskDate`）點整個欄位即開啟選擇器。教訓：`.date-jump` 必須設 `width:auto` 蓋掉全域 `input { width:100% }`，否則會撐開導航列把標題擠成直排。
- 新增 / 編輯 / 刪除行程
- 日 / 週 / 月檢視
- 完成勾選
- 重複行程：每天 / 每週 / 每月
- 重複行程每日獨立完成
- 重複行程單次編輯（僅這次覆寫、這次及之後切割）與行程衝突偵測
- 分類與顏色
- 自訂分類
- 自訂畫面文字
- 自訂日檢視顯示時間範圍
- 子任務清單
- 行程複製到明天
- 行程置頂
- 逾時標紅
- 每日備忘錄
- 快速範本
- 本週 / 本月完成統計
- 清理已完成舊行程
- 提醒時間：不提醒 / 準時 / 5 / 10 / 30 分鐘前
- 重要度篩選
- 今日待辦模式
- 桌面小工具模式
- 拖曳調整日期；同日拖曳可調整排序
- 關鍵字標籤
- 完成音效
- 每週目標
- CSV 匯出
- PDF / 列印
- JSON 備份 / 還原
- 國定假日標示（2025–2027，`TAIWAN_HOLIDAYS`）
- 近 7 天完成統計長條圖
- 番茄鐘 / 專注計時
- .ics 匯出 / 匯入（含 RRULE 轉換）
- 彈性重複規則：每隔 N 天、只工作日、每月第 N 個週幾
- 農曆顯示（1900–2100，純前端換算）
- 日檢視時間軸模式（可拖曳調整結束時間）
- PWA（`manifest.json` / `service-worker.js`，需透過 `start-pwa-local.bat` 本機伺服器才能安裝/離線）
- 系統推播通知
- 雲端同步 scaffold（`sync.js`）：預設未設定 = 純本機、不發網路請求；設定 `config.js` 後可 Google 登入、手動/自動同步備份 JSON 到 Supabase，last-write-wins，詳見 `CLOUD_SETUP.md`
- Android PWA「長按主畫面圖示」快捷選單（App Shortcuts）：`manifest.json` 的 `shortcuts` 陣列定義三個項目（新增行程／今日待辦／番茄鐘），`url` 分別指向 `./index.html?action=quickadd`、`?action=todaytodo`、`?action=pomodoro`。`app.js` 的 `init()` 在 `render()` 之後呼叫 `handleUrlShortcutAction()`：讀 `new URLSearchParams(window.location.search).get('action')`，依值呼叫既有的 `openTaskDialog({ date: toDateInput(currentDate) })` / `toggleTodayTodoMode()`（先檢查 `todayTodoMode` 避免重複觸發）/ `openPomodoroDialog()`，處理完用 `history.replaceState(null, '', window.location.pathname)` 清掉網址上的 `?action=...`。`service-worker.js` 的 fetch handler 對帶 query string 的請求會 cache miss、直接打網路拿到同一份 `index.html`（Cloudflare Pages 靜態站標準行為），只有離線 fallback 到快取版 `index.html` 時網址上的 query 仍在、`app.js` 一樣讀得到，不需要額外改 SW 邏輯；這次順手把 `CACHE_NAME` 從 v3 升到 v4 讓已安裝的舊版本更快抓到新 `manifest.json`。iPhone（Safari）PWA 不支援長按快捷選單。
- 日／週／月檢視一鍵清除：「🗑 清空當日」（`clearDayBtn`，只在日檢視顯示，函式 `clearDayTasks()`）、「🗑 清空本週」（`clearWeekBtn`，只在週檢視顯示，函式 `clearWeekTasks()`）、「🗑 清空本月」（`clearMonthBtn`，只在月檢視顯示，函式 `clearMonthTasks()`）。三者邏輯一致：非重複行程整筆刪除；重複行程改記到 `task.excludedDates`（牽涉到的日期不再出現，其他天不受影響），`occursOnDate()` 最前面會先檢查 `excludedDates` 是否包含目標日期並直接回傳 `false`。點擊後用 `confirm()` 跳出確認，確認才會清除並顯示 toast。週／月版本共用 `clearTasksForDateKeys(dateKeys, label)` 這個輔助函式：先掃描整個日期範圍，把「要刪除的非重複行程 id」與「重複行程要新增的 excludedDates」蒐集完才一次套用，避免逐天處理時 tasks 陣列被提前修改而找不到物件；月範圍只算當月 1 號到月底（`daysInMonth()`），不含 `renderMonth()` 網格補齊的跨月天數。三顆按鈕的顯示/隱藏邏輯都整合在 `updateDayModeSwitch()`（今日待辦模式、小工具模式時全部隱藏）。
- 倒數日：task 新增布林欄位 `countdown`（預設 `false`），`#taskDialog` 加了「⏳ 顯示在倒數日」checkbox（`taskCountdown`），`openTaskDialog()`/`saveTaskFromForm()`/`normalizeStoredData()` 同步處理（跟其他欄位一樣走整包 tasks 備份，不用改 `buildBackupPayload()`/`applyBackupObject()`）。側欄「今日重點」下方新增面板（`#countdownList`），渲染函式 `renderCountdownPanel()`（掛在 `render()` 流程裡）：篩出 `countdown=true` 的行程，用 `nextCountdownOccurrence(task, fromDateKey)` 算出「今天起最近一次出現的日期」（不重複行程直接比較 `task.date`；重複行程逐日往後掃描最多兩年），依日期近到遠排序，顯示「還有 N 天｜標題｜M/D」，當天顯示「就是今天！」，沒有項目顯示「尚無倒數事項」。點列表項目（`data-countdown-edit`）會開啟編輯視窗，綁在 `handleCalendarClick()` 裡新增的分支（用 `closest()` 找 `[data-countdown-edit]`，跟現有 `data-edit-task` 走不同 dataset key，避免互相干擾）。
- Agenda 列表檢視（第四種檢視）：`view-switch` 新增第四顆 `data-view="agenda"` 鈕（文字「列表」），沿用既有的通用 view-btn click 綁定邏輯，不用額外改 `bindEvents()`。`renderCalendar()` 新增 `currentView === 'agenda'` 分支呼叫 `renderAgenda()`：從 `currentDate` 起算 30 天，逐日算 `occursOnDate()`，把有行程的日期分組（沒行程的日期整組跳過），每組標題顯示今天/明天字樣、星期、M/D、農曆小字、假日名，底下用既有 `taskCard()` 列出當天所有行程；30 天內完全沒行程時顯示空狀態文案。`renderTitle()` 加 `agenda` 分支顯示「未來 30 天」；`navigate()` 加 `agenda` 分支以 30 天為單位前後跳；`updateDayModeSwitch()` 不用特別改，因為裡面所有顯示判斷都是嚴格比對 `currentView === 'day'/'week'/'month'`，`agenda` 天然不會命中，日模式切換鈕與清空當日/週/月鈕自動隱藏。手機版 `.view-switch .view-btn` 在 `max-width:760px` 內縮小 padding/字級以容納四顆按鈕，桌面版不受影響。
- 深色模式三段循環（跟隨系統）：`THEME_KEY` 存值由二元的 `'light'/'dark'` 改成三段 `'light'|'dark'|'auto'`。新增 `getStoredThemeMode()`（讀存值，非法值一律視為 `'light'`）、`systemPrefersDark()`（`matchMedia('(prefers-color-scheme: dark)').matches`）、`applyTheme()`（唯一「由存值算出實際深淺並套用 `body.dark` + 更新 `themeBtn` 圖示與 `title`」的地方：淺色 🌙、深色 ☀️、自動 🌗）、`bindSystemThemeListener()`（`matchMedia(...).addEventListener('change', ...)`，只在存值為 `'auto'` 時才呼叫 `applyTheme()` 即時跟隨系統切換，`init()` 呼叫一次註冊）。`toggleTheme()` 改成在 `['light','dark','auto']` 三段之間循環，切換時 toast 顯示「主題：淺色/深色/自動(跟隨系統)」。`init()`、`toggleTheme()`、`applyBackupObject()` 都改呼叫 `applyTheme()`（`applyBackupObject()` 原本直接操作 `classList`/`themeBtn.textContent` 那幾行已移除，改成先合法值檢查 `data.theme`（`'light'/'dark'/'auto'` 才寫入 `localStorage`，避免舊備份或壞資料寫入其他字串）再呼叫 `applyTheme()`）。舊備份沒有 `'auto'` 這個值不受影響，行為等同以前的 `'light'/'dark'` 二元判斷。
- 月檢視熱力圖：`renderMonth()` 每格依「當天完整行程數」（`allDayTasks.length`，非畫面上限顯示 4 筆後的 slice 結果）用 `heatClass(count)` 決定 class：0 筆不加、1–2 筆 `mh-1`、3–4 筆 `mh-2`、5 筆以上 `mh-3`；class 加在 `month-day` 其他既有 class（`today`/`outside`/`holiday`）前面，CSS 裡 `.month-day.mh-1/2/3` 的宣告也刻意寫在 `.month-day.holiday` 規則之前，同樣兩個 class 的權重下靠 CSS 來源順序讓假日紅底自然覆蓋熱力底色、`today` 外框高亮完全不受影響（它只動 `border`/`box-shadow` 不動 `background`）。底色用 `color-mix(in srgb, var(--primary) N%, var(--surface-strong))`（N=8/16/26），會跟著淺色/深色主題的 `--primary`/`--surface-strong` 自動變色。格子 `title` 屬性改成「N 筆行程」。
- 雲端備份版本（誤覆蓋救援，選用功能）：新表 `public.sync_history`（定義在新檔 `schema-history.sql`，不動既有 `schema.sql`／`sync_state`），欄位 `id bigserial` / `user_id` / `payload jsonb` / `created_at`，RLS 開 select/insert/delete 三者皆限 `auth.uid() = user_id`，並建 `(user_id, created_at desc)` 索引。`sync.js` 新增 `saveHistorySnapshot(backupObject)`：`syncNow()` push 分支與 `forcePushToCloud()` 成功後都會呼叫（`.catch(()=>{})` 收尾，不 await 阻塞主流程），POST 一筆快照後接著修剪只保留每位使用者最新 **10 份**（第 11 份以後用 `DELETE ...id=in.(...)` 刪除）。整段設計是**fire-and-forget**：內部整包 try/catch，任何失敗（含 `sync_history` 表尚未建立的 404/PGRST205）一律只 `console.warn`，絕不 throw、絕不影響主同步流程——沒執行 `schema-history.sql` 的使用者，雲端同步行為與沒有這個功能時完全一樣。新增 `listHistory()`（GET 最新 10 筆 `id,created_at,payload`，連線失敗或表不存在回傳 `null`，表存在但沒有快照回傳 `[]`，UI 依這兩種情況顯示不同提示文字）與 `restoreHistory(id)`（`confirm()` 二次確認 → `applyBackupObject()` 套用到本機 → `cloudPush()` 推成雲端最新 → 用伺服器回傳時間更新 `lastSyncedAt`（同 `syncNow()` push 分支寫法）→ toast 並關閉對話框 → 還原動作本身也呼叫一次 `saveHistorySnapshot()` 留痕）。UI：`cloudSyncLoggedInBox` 內新增「🕘 雲端備份版本」按鈕（`cloudHistoryBtn`），新對話框 `cloudHistoryDialog`／`cloudHistoryList`（沿用 `task-dialog` class，手機底部彈出樣式自動繼承），清單每列顯示「YYYY/M/D HH:mm:ss｜N 筆行程」＋「還原」鈕。設定步驟與行為說明見 `CLOUD_SETUP.md`「版本備份（選用）」段落。
- 自然語言快速新增：`#taskTitle` 標題輸入框支援中文日期／時間語彙輸入，純解析邏輯是 `app.js` 的 `parseNaturalDateTime(text, baseDate)`（完全不依賴 DOM 的純函式，回傳 `{ title, date, start, end }`，抓不到的欄位為 `null`）。日期語彙：今天／明天／後天／大後天、下週一～下週日（含「下周」寫法，一律算下一週）、週一～週日／星期一～星期日／禮拜一～禮拜日（本週該日，已過則算下週）、N月N日／N月N號、N/N（月/日，今年，已過則算明年）。時間語彙：上午／早上／下午／晚上＋N點（可帶「半」或「:MM」分鐘，數字支援中文一～十二）、純數字＋點（無上下午詞時，12 以下且 <8 視為下午/晚上、否則照原值）、24 小時制（含 `HH:MM-HH:MM` 區間），全形／半形數字與冒號都會先經 `nlToHalfWidth()` 正規化再解析；只有 start 沒有 end 時 `end = start + 1 小時`。設計保守：時間語彙必須通過 `nlHasValidBoundary()`（前後是斷詞邊界或字串端點）才承認是時間，用來擋掉「3點檔」「第3點」這類數字+點不是真時間的情況，拿捏不準就完全不解析該段。DOM 掛接：`els.taskTitle` 的 `blur` 事件呼叫 `applyNaturalLanguageParse()`（套用解析結果、剝離標題、跳 toast「已解析：M/D HH:MM」）；`saveTaskFromForm()` 開頭另外呼叫 `applyNaturalLanguageParseOnSubmit()` 當保險（給 Enter 直接送出、`taskTitle` 沒機會 blur 的情況兜底），只有日期／開始／結束欄位仍等於 `openTaskDialog()` 開窗當下記錄的 `taskDialogDefaults` 快照（代表使用者沒手動改過該欄位）時才會逐欄位套用，避免蓋掉使用者手動調整過的值。標題欄位下方新增一行固定顯示的 `.muted.nl-hint` 提示文字。
- 語音輸入：`#taskTitle` 旁新增 `#voiceInputBtn`（🎤，`.icon-btn`，與輸入框同列排在新的 `.title-input-row` 內）。`setupVoiceInput()` 在 `init()` 時執行一次：先偵測 `window.SpeechRecognition || window.webkitSpeechRecognition`，偵測不到就直接 `btn.remove()` 整顆移除（降級，不影響其他功能）；偵測到就建立 `recognition`（`lang='zh-TW'`、`interimResults=false`），點擊按鈕開始聆聽（🎤→🔴，title 提示「聆聽中…再按一次停止」），辨識結果（`result` 事件）append 到 `#taskTitle` 現有文字後並自動呼叫 `applyNaturalLanguageParse()` 觸發自然語言解析；再點一次按鈕呼叫 `recognition.stop()` 可停止聆聽。`error` 事件（例如麥克風權限被拒絕）跳 toast「無法使用麥克風」並還原按鈕圖示；`end` 事件（辨識自然結束）也會還原按鈕圖示與聆聽狀態。
- 背景推播提醒 scaffold（Web Push，**進階選用功能，預設停用零影響**）：`config.js` 沒填 `webPushPublicKey` 時，`push.js`（新檔案，`index.html` 在 `sync.js` 之後多載入一行 `<script src="push.js"></script>`）最上面就 `return`，不插入任何 UI、不註冊事件、不打任何網路請求，跟加入這個功能之前完全一樣。設定好之後：「☁️ 雲端同步」對話框登入區（`#cloudSyncLoggedInBox`）會動態插入一個「📲 背景推播提醒」勾選框＋狀態小字（用 `MutationObserver` 跟著 `#cloudSyncLoggedInBox` 的 `hidden` 屬性變化即時刷新狀態，不用改 `sync.js` 既有的 `updateUI()`）；勾選會走 `Notification.requestPermission()` → `pushManager.subscribe()` → upsert 到 Supabase 的 `push_subscriptions` 表，取消勾選則 `unsubscribe()` ＋刪除該筆雲端訂閱紀錄；未登入雲端時 checkbox disabled 並顯示「請先登入雲端同步」，不支援的瀏覽器（偵測 `PushManager`、`file://` 一律視為不支援）顯示「此瀏覽器不支援背景推播」。`sync.js` 只新增一個匯出 `window.CalendarSync.getAuthState()`（回傳目前登入狀態的淺拷貝，供 `push.js` 讀取 access token／user id，沒有動任何既有函式）。`service-worker.js` 新增 `push`／`notificationclick` 兩個事件（未動 `CACHE_NAME` 與既有 `install`/`activate`/`fetch`）：收到推播用 `showNotification()` 顯示（解析失敗用預設文字），點通知會 focus 既有視窗或開新視窗。伺服器端由新檔案 `schema-push.sql`（`push_subscriptions` 存訂閱、`push_sent_log` 防重複通知，皆有 RLS，`push_sent_log` 刻意不開任何 policy，只讓 service_role 讀寫）與 `supabase/functions/send-reminders/index.ts`（Deno Edge Function，用 service_role 讀 `sync_state` 全部使用者的 payload，對「今天出現、有設提醒分鐘數、提醒時刻落在執行窗口內、未完成」的行程發送 Web Push，簡化移植 `occursOnDate()` 判斷重複規則並逐條核對過與 `app.js` 的規則字串一致，時區依 `TZ` 環境變數預設 `Asia/Taipei`，過期訂閱 404/410 自動清除）組成，皆需**使用者自行**依 `CLOUD_PUSH_SETUP.md` 部署（設定 secrets、Dashboard 建立 Function、設定 Cron 排程），未部署也完全不影響前端任何功能。**2026-07-16 查證後改版**：發送邏輯**不用** `npm:web-push`，改成完全不依賴任何第三方套件、只用 Deno/瀏覽器原生 Web Crypto API（`crypto.subtle`）手刻 RFC 8291（aes128gcm 訊息加密）＋ RFC 8188（內容編碼）＋ RFC 8292（VAPID JWT）；原因是 `npm:web-push` 在 Deno 執行環境有記錄在案的 AES-GCM 解密失敗問題（含使用者在 Supabase Edge Function 情境下的實際回報，見 `denoland/deno` GitHub issue #23693），且找到的兩個替代套件（`@block65/webcrypto-web-push` 用的是已淘汰的 `aesgcm` 舊格式；`jsr:@negrel/webpush` 金鑰格式不相容且作者自述未經密碼學專家審查）都不夠可靠，因此改為手刻並用 RFC 8291 Appendix A 官方測試向量逐位元組核對過中間值（ecdh_secret／PRK_key／IKM／PRK／CEK／NONCE／最終密文皆位元組相符）、VAPID JWT 簽章也做過 sign→verify 迴圈測試；金鑰格式維持跟 `npx web-push generate-vapid-keys` 產生的標準 raw base64url 格式相容，`config.js` 的 `webPushPublicKey` 與 `CLOUD_PUSH_SETUP.md` 的金鑰產生步驟都不用改。部署方式也改成**全程 Supabase Dashboard 圖形介面**（不需要 Supabase CLI／Node.js／終端機）：SQL Editor 貼 `schema-push.sql`、Edge Functions 頁面「Deploy a new function → Via Editor」貼 `index.ts` 全部內容部署、Function Secrets 頁面填三個 VAPID 環境變數、SQL Editor 執行 `cron.schedule(...)`（`pg_cron`+`pg_net`，已內附這個專案的正式 Function 網址）設定每 10 分鐘排程。`index.ts` 內的「重複行程當日判斷＋提醒視窗計算」抽成單一純函式 `isReminderDue()`，另外移植成 Node 可跑的版本測過 13 個案例（每天/每週/每月/每隔 N 天/只工作日/每月第 N 個週幾/每月最後一個週幾重複、excludedDates 排除、reminder=0/30、跨日視窗邊界、以及兩個負向案例）全數通過，測試檔用完即清空內容。**2026-07-16 Worker F 體驗完善（僅動 `push.js`／`styles.css`，未動 `sync.js`/`app.js`/`service-worker.js`/`CACHE_NAME`/`manifest.json`）**：訂閱 UI 加分隔線＋小標題「🔔 背景提醒」（新增 `.push-block`/`.push-heading` class）跟上面「自動同步／立即同步／登出…」按鈕群拉開視覺區隔，checkbox＋狀態小字排版沿用既有 `.checkbox-field`／`.muted`，配色沿用既有 CSS 變數（`--border`/`--text`/`--muted`）自動跟著深色模式切換。訂閱成功（checkbox 勾選）時顯示「🔔 發送測試通知」按鈕（`#pushTestRow`，預設 `hidden`，CSS 用 `.push-test-row:not([hidden])` 寫法避免作者樣式蓋掉瀏覽器內建 `[hidden]{display:none}`，跟既有 `.fab-add:not([hidden])` 同一招）：呼叫 `navigator.serviceWorker.ready` 後 `registration.showNotification('測試通知', {...})` 純本機驗證「瀏覽器端顯示路徑」，不經過雲端／VAPID／Supabase，按鈕下方小字註明「雲端排程推播需完成 `CLOUD_PUSH_SETUP.md` 部署後才會運作」；未訂閱時按鈕隱藏；Notification 權限被拒時按下去改跳 toast 提示到瀏覽器設定重新允許。情境提示強化三種狀態：(1) iOS Safari 尚未加入主畫面（`navigator.standalone === false` 且 UA 含 iPhone/iPad 且不支援 `PushManager`）時狀態字顯示「iPhone 需先把本頁加入主畫面（iOS 16.4+）才能使用背景提醒」（`isIOSNeedsHomeScreen()`）；(2) `Notification.permission === 'denied'`（使用者曾拒絕過）時 checkbox 直接 `disabled`、狀態字「通知權限已被封鎖，請到瀏覽器網站設定重新允許」，不會再徒勞觸發一次無效的 `requestPermission()`；(3) 訂閱／取消訂閱呼叫中 checkbox `disabled`＋狀態字「訂閱中…」/「取消訂閱中…」（`onToggleChange()` 最前面先設定，再進 `subscribe()`/`unsubscribe()`）。手機 760px 底部彈窗已確認排版：`.push-block` 為 flex column、測試通知按鈕 `.push-test-row .ghost-btn { width:100% }` 貼齊容器寬度不會超寬，說明文字為一般 `<p>` 正常換行，未另外新增手機專屬 media query（既有 flex-column 版型本身即為響應式）。
- 頁尾版權宣告（2026-07-21）：`index.html` app-shell 後 `<footer class="app-footer">© 2026 行事曆0.001版</footer>`，粗體圓體字族置中，深色模式白字，列印隱藏。
- **2026-07-22 全速施工波次（總指揮 Fable 5 派工 W1–W5，13 個工作包全數完工，測試 36/36）**：
  - W1 安全網：`tests.html` 測試跑道（36 案例，localStorage 快照保護；`window.CalendarApp` 加曝 occursOnDate/parseNaturalDateTime/timeOverlaps/computeWeeklyReview）；🩺 資料檢查修復工具（`runDataCheck()`/`fixDataIssues()`，修復前自動備份）；錯誤紀錄匯出；SW「立即更新」提示（**行為改動**：SW 不再自動 skipWaiting，改由使用者按 `#swUpdateBanner` 的按鈕觸發 SKIP_WAITING message）。
  - W2 快速收割：App Badge 今日未完成數（`updateAppBadge()`）；習慣 streak（`habitStreak()`，🔥N≥2 顯示）；📋 批量貼上匯入（逐行走 `parseNaturalDateTime()`，上限 50 行）；PWA Share Target（manifest `share_target`，param 前綴 share_，**已安裝 PWA 需移除重裝才生效**）；⚡ 找空檔（`findNextFreeSlot()`，當天無空檔往後找 7 天）；⏭ 未完成順延到下個工作日（`deferUnfinishedTasks()`，跳過週末與假日，重複行程不動）。
  - W3 操作統計：Ctrl+K 命令面板（`#commandPalette`，指令＋行程搜尋，`COMMAND_PALETTE_ACTIONS`）；📈 進階統計儀表板（`computeDashboardStats()` 純函式：分類工時/8 週趨勢/逾期/時段分布）；提醒通知互動（SW showNotification actions 完成/延後 10 分鐘，`handleNotificationAction()`，snooze 僅頁面存活時有效；**雲端推播路徑未動**）。
  - W4 台灣家庭包：農曆每年重複（repeat 新合法值 `lunar-yearly`，`occursOnDate()` 農曆月日比對、閏月不匹配、.ics 匯出降級單次）；Open-Meteo 天氣（日/週/月/Agenda 顯示，失敗全靜默）；台灣假日自動更新（`getHoliday()` 先查動態表）；備份可選 AES-GCM 密碼加密（`exportBackup()` **已改 async**，PBKDF2 150k，加密檔 `.enc.json`，`importBackup()` 自動偵測）。
  - W5 美化除錯：全域 UI polish（過渡動畫/dialog 進場/雙層陰影/細捲軸/focus-visible/prefers-reduced-motion）；🖼 當日行程分享圖卡（canvas 720px，Web Share API 優先、下載 fallback）；掛牆看板模式（`#kioskOverlay` 全螢幕時鐘＋今日行程，命令面板或更多選單開啟，Esc 離開）；整合稽核修掉 async 呼叫鏈順序 bug 與 9 個 dialog 連點 InvalidStateError 防護，`.conflict-warning` 補深色模式。
- 📎 行程附件（2026-07-22）：`#taskDialog` 備註欄之後新增附件區（`#attachmentSection`），可加入照片/檔案（單檔 ≤5MB、每筆行程 ≤10 個），存本機 IndexedDB（`desktop-schedule-attachments`），詳見上方「行程附件（IndexedDB，2026-07-22）」小節。`taskCard()` 顯示 `📎N` 徽章。IndexedDB 不可用時整區隱藏，其餘功能不受影響。
- 每週回顧：新對話框 `#weeklyReviewDialog`，開啟入口有兩個——桌面工具列 `#weeklyReviewBtn`（放在「今日待辦」旁，手機寬度時比照其他次要工具鈕用 id 加進 CSS 隱藏清單、改走 `#moreToolsDialog`）與 `#moreToolsDialog` 內的 `#moreToolsWeeklyReviewBtn`（不是 proxy click，自己的 click handler 直接關掉更多視窗再開週回顧視窗）。統計邏輯是 `app.js` 的 `computeWeeklyReview(baseDate)`（不碰 DOM 的純函式，只讀全域 `tasks`／`weeklyGoals`／`categories`）：以 `startOfWeek(baseDate)` 算出本週一到週日，逐日呼叫 `occursOnDate()` 掃描每筆行程「當天是否出現」（重複行程每天各算一次出現，不是只算一次），完成判定用既有 `isTaskDone()`；回傳本週/上週的 `{ total, done, rate }`、完成率升降 `trend`（`'up'|'down'|'same'`）、依 `categories` 順序整理且只留「本週有資料」最多 6 筆的分類完成/總數、下週（`thisMonday+7`）總出現次數與前 3 筆 `{date, title}` 預覽（依日期→開始時間排序）、本週 `weeklyGoals`（`week === toDateInput(thisMonday)`）的 `{ total, done }`。渲染另外寫在 `renderWeeklyReview()`（單純读 `computeWeeklyReview()` 回傳值塞進各 DOM 元素，不重複算邏輯）。

## 重要實作規則

1. 盡量維持純前端，不引入框架。
2. 不要破壞現有 `localStorage` 相容性。
3. 新增資料欄位時，必須更新：
   - `normalizeStoredData()`
   - `exportBackup()`
   - `importBackup()`
   - `README.md`
4. UI 文字若屬常用顯示文字，盡量納入文字設定。
5. 行程完成狀態使用 `completedDates`，不要改回單一 `done`。
6. 重複行程要透過 `occursOnDate(task, dateKey)` 判斷。
7. 修改後至少手動測：新增行程、完成勾選、切換檢視、備份還原。

## app.js 核心區塊

- 常數與預設值：檔案開頭
- DOM refs：`els`
- 初始化：`init()`
- 事件綁定：`bindEvents()`
- 主渲染：`render()`
- 日 / 週 / 月渲染：`renderDay()`、`renderWeek()`、`renderMonth()`
- 行程卡片：`taskCard()`
- 新增 / 編輯行程：`openTaskDialog()`、`saveTaskFromForm()`
- 篩選：`getFilteredTasks()`
- 提醒：`checkReminders()`
- 備份 / 還原：`exportBackup()`、`importBackup()`（內部呼叫 `buildBackupPayload()` / `applyBackupObject()`，這兩個是備份資料格式的單一真相，`sync.js` 也透過 `window.CalendarApp` 呼叫它們，避免資料格式各自漂移）
- 資料相容：`normalizeStoredData()`
- 提供給 `sync.js` 的介面：檔案最底部的 `window.CalendarApp`（`buildBackupPayload`、`applyBackupObject`、`isAutoSyncEnabled`/`setAutoSyncEnabled`、`showToast`、可被 `sync.js` 掛上的 `onDataChanged` 鉤子；`render()` 存檔後會呼叫它，外層包 try/catch，沒有載入 sync.js 或呼叫失敗都不影響本機功能）
- 日期工具：檔案底部

## 建議新增功能（截至 2026-07-21）

下一階段優先強化「資料可靠性、整合、智慧排程」，而非只增加按鈕。

### 本階段已完成

- 重複行程編輯已支援「僅修改這次／修改這次及之後／修改整個重複系列」。單次修改透過原系列 `excludedDates` 加上非重複覆寫行程實作；這次及之後則以 `repeatUntil` 截止舊系列並建立新系列。
- 行程表單已支援同日時間重疊警告；目前只提示衝突，不阻止儲存。
- `_we_test.js` 已加入 `occursOnDate()`、`excludedDates`、`repeatUntil` 的基礎 Node 迴歸案例並可執行，但目前測試內仍複製部分規則，尚未直接引用正式 `app.js`。

### 建議實作順序（未完成）

1. 建立可直接測正式程式碼的自動化測試，並加入資料檢查／修復工具。
2. 補上自動尋找空檔與進階智慧排程。
3. 通知互動（完成／延後／再提醒）。
4. 逐筆雲端同步與衝突解決（取代整包覆蓋）。
5. Google Calendar 整合或家庭共享日曆。

### 優先度總表

| 優先 | 功能 | 價值 | 難度 |
|---|---|---|---|
| 1 | 逐筆雲端同步與衝突處理 | 取代整包 JSON last-write-wins，避免裝置互相覆蓋 | 高 |
| 2 | 自動化測試與資料修復 | 直接驗證正式邏輯，檢查壞資料、重複 ID、非法日期 | 中高 |
| 3 | 空檔偵測與智慧排程 | 在既有重疊警告上，自動尋找可用時段 | 中 |
| 4 | 通知延後與直接完成 | 通知上提供「完成／延後／明天提醒」 | 中高 |
| 5 | Google Calendar 整合 | 匯入或雙向同步既有日曆 | 高 |
| 6 | 專案與任務依賴 | 任務分群、設前置任務、呈現進度 | 中高 |
| 7 | 全域快速搜尋／命令面板 | 鍵盤搜尋行程、快速新增、切換檢視 | 中 |
| 8 | 進階統計儀表板 | 分類工時、延期率、完成趨勢、專注時間 | 中 |
| 9 | 分享行程／家庭共同日曆 | 指定成員共同查看、編輯或唯讀分享 | 高 |
| 10 | 時區與旅行模式 | 跨國自動換算時間並保留原時區 | 中高 |

### 核心升級細節

#### 1. 逐筆同步（取代整包覆蓋）
目前同步是整份備份互相覆蓋。建議每筆資料具備 `id` / `createdAt` / `updatedAt` / `deletedAt`（tombstone）/ `deviceId` / `revision`，以達成：
- 手機新增 A、電腦新增 B 可合併，而非互相覆蓋。
- 刪除透過 tombstone 正確同步。
- 衝突時讓使用者選版本。
- 離線修改恢復連線後自動補送。
（這是讓專案能長期多裝置使用的最高價值升級。）

#### 2. 智慧排程（部分完成）
- ✅ 時間重疊警告。
- ⬜ 自動尋找下一個空檔。
- ⬜ 行程前後緩衝時間。
- ⬜ 依工作時間／重要度／期限安排待辦。
- ⬜ 未完成行程一鍵移到下一個工作日。

#### 3. 通知互動
- 通知直接標記完成。
- 延後 5／10／30 分鐘。
- 今日稍後提醒。
- 點通知直接開啟指定行程。
- 未回應提醒自動再通知一次。

### 品質面補強
- 自動化測試：`occursOnDate()` 已有基礎獨立腳本；仍需直接連結正式邏輯，並涵蓋自然語言解析、備份還原、同步合併。
- 資料修復工具：檢查壞資料、重複 ID、非法日期。
- 更新提示：新版 Service Worker 就緒時顯示「立即更新」。
- 錯誤紀錄匯出：產生不含個資與權杖的診斷檔。
- 無障礙：完整鍵盤操作、焦點管理、ARIA、對比檢查。

## 後續可製作方向

### PWA 版（✅ 已完成並經正式站實測）

`manifest.json` / `service-worker.js` / `icons/` / 離線快取 / README 教學皆已完成。
已透過正式站 https://calendar88.pages.dev/ 實際安裝到手機驗證（含修復安裝版 ERR_FAILED bug，見「已知注意事項」）。`start-pwa-local.bat` 僅剩「無對外網路、純區網」情境未測，非必要項。

### 雲端同步實際上線（✅ 已完成並實測收工，2026-07-16）

已依 `CLOUD_SETUP.md` 建立 Supabase 專案（calendar-gogo）、跑 `schema.sql`、啟用 Google 登入（Google Auth Platform 已發布為實際運作中，家人各自的 Google 帳號都能登入、資料彼此隔離）、填入 `config.js` 正式金鑰。電腦 + Android 手機兩台裝置實測 last-write-wins 同步成功收斂。實測過程抓出並修復四個同步 bug，教訓都記錄在「已知注意事項」。

### Android 安裝檔

若要真正 `.apk`：建議使用 Capacitor，需新增 Node 專案、Android Studio / Gradle 環境；目前程式可作為 Web assets 放入 Capacitor。

### iOS 安裝檔

需 macOS + Xcode + Apple Developer Program。

## 正式上線網址

已部署到 Cloudflare Pages，供手機/其他電腦跨網路存取：

- 網址：https://calendar88.pages.dev/
- 原始碼倉庫：https://github.com/apply-git/calendar.git（Git 整合部署，`git push` 到 `main` 分支會自動觸發重新部署，Framework preset：None，無 build step，輸出目錄 `/`）
- 手機加入主畫面：直接用瀏覽器開這個網址，比照 README「PWA 安裝與離線使用」步驟加入主畫面即可，**不需要**再透過 `start-pwa-local.bat` 區網方式（那個仍保留給沒有網路、只想純區網用的情境）。
- Supabase 的 Google 登入 Redirect URL 要設定為這個網址（見下方雲端同步段落）。

## 已知注意事項

- 桌面通知在 `file://` 不同瀏覽器限制不同，正式 PWA 用 HTTPS 較穩。
- iPhone PWA 的通知支援受系統版本影響。
- 雲端同步**已於 2026-07-16 用真實 Supabase 專案（calendar-gogo）＋ Google 登入在電腦與 Android 手機兩台裝置實測收工**：兩台裝置登入同一 Google 帳號、互相推拉資料成功收斂一致。過程中抓出並修掉四個 bug（見下方各條教訓）。`config.js` 已填入正式金鑰（anon key，可公開）。預設未設定時仍是純 localStorage、不發網路請求的行為不變。
- 登入用的 access/refresh token 存在 `desktop-schedule-sync-auth-v1`，刻意不放進備份 JSON；換瀏覽器/清資料需要重新走一次 Google 登入。
- **`lastSyncedAt` 必須永遠來自伺服器時間，不能用裝置本機 `Date.now()`（已修過的 bug，教訓記錄）**：`syncNow()` 用 localStorage 存的 `lastSyncedAt`（`desktop-schedule-sync-meta-v1`）跟雲端 `sync_state.updated_at` 比大小，決定要 pull 還是 push。早期版本裡，pull 分支存伺服器時間沒問題，但 push 分支存的是 `Date.now()`（裝置本機時鐘）；`cloudPush()` 當時用 `Prefer: return=minimal`，前端根本拿不到伺服器實際寫入的 `updated_at`，只能用本機時間硬猜。如果某台裝置（常見是手機）系統時鐘跟伺服器對不準，就會一直存下不準的 `lastSyncedAt`，之後每次比較都判斷錯誤，症狀是這台裝置永遠只會單向覆蓋雲端、收不到其他裝置的更新，使用者狂按「立即同步」也沒用。修法：`cloudPush()` 改用 `Prefer: return=representation`，讓 PostgREST upsert 回傳寫入的那一列（陣列格式，取 `data[0].updated_at`），`syncNow()` 的 push 分支改成用這個伺服器回傳值算 `lastSyncedAt`（`new Date(serverUpdatedAt).getTime()`），只有在真的拿不到回傳值時才 fallback 用 `Date.now()`（並 `console.warn` 留記錄）。以後任何會寫 `lastSyncedAt` 的地方都要遵守這條規則。**已修過但這個 bug 觸發過的裝置，`lastSyncedAt` 舊值仍留在該裝置 localStorage，光部署新版程式不會自動修正**（下次同步仍會先用這個殘留的錯誤值比較一次）；因此同時把 `logout()`／`clearAuthState()` 改成登出時一併清掉 `desktop-schedule-sync-meta-v1`，讓「登出→重新登入」變成使用者不用碰開發者工具就能重置同步紀錄的方法：卡住的裝置（通常是手機）登出再登入一次，下次同步會強制重新跟雲端比對。
- **PWA Service Worker 快取陷阱**：`config.js`/`sync.js` 更新後（例如剛設定好 Supabase 金鑰）部署上線，若某個瀏覽器/裝置之前已經開過這個網址一次，Service Worker 會把「當時那份舊版」`config.js` 存進離線快取，之後不管怎麼重新整理都會被 SW 攔截優先給舊版，導致畫面一直顯示「雲端同步未設定」。驗證方式：`navigator.serviceWorker.getRegistrations()` 逐一 `unregister()` 再 `caches.keys()` 逐一 `caches.delete()`，然後重新整理。一般使用者可以用瀏覽器「清除瀏覽資料/快取」或把 PWA 從主畫面移除重新加入解決。這不是部署失敗，純粹是 SW 離線快取的預期行為。
  - **重要**：只改 `app.js`/`sync.js`/`config.js` 等內容、卻沒動 `service-worker.js` 本身時，瀏覽器偵測不到 `service-worker.js` 這個檔案的位元組有變化，就不會安裝新 SW，舊快取會**永久**留著，跟使用者端「清瀏覽器快取」完全無關（手機上「清快取」常常不會動到 PWA 自己的 Cache Storage / 已註冊的 Service Worker）。**規則：只要改了 `APP_SHELL` 陣列裡任何一個檔案的內容，就必須同時把 `service-worker.js` 開頭的 `CACHE_NAME` 版本號往上加一**，這樣瀏覽器才會偵測到 SW 本體變了、觸發安裝新版並清掉舊快取。這次修 `sync.js` 時鐘不一致 bug 就漏了這步，導致「重新整理／清快取都沒用」，已補上 `CACHE_NAME` 升到 `v5` 並記錄在此，以後任何 `APP_SHELL` 內檔案異動都要記得同步升版。
- **`cloudPull()`/`cloudPush()` 連線失敗不能靜默回傳 `null`（已修過的 bug，教訓記錄）**：實測時發現手機一次連線／權杖更新暫時失敗，`syncNow()` 卻把這種「連線失敗」誤判成「雲端還沒有資料」，結果走到 push 分支，把手機本機的舊資料（甚至是全新安裝從沒同步過的內建範例行程）整包推上雲端，蓋掉了電腦剛寫上去的正確資料。根因是 `cloudPull()`／`cloudPush()` 原本把「`ensureFreshToken()` 失敗」「`authState.user.id` 拿不到」跟「雲端真的還沒有這個帳號的資料列」都用回傳 `null` 表示，`syncNow()` 沒辦法分辨這兩種情況。修法：`ensureFreshToken`/`userId` 失敗時改成 `throw`（讓 `syncNow` 的 `catch` 整段中止、顯示同步失敗，不會誤觸發覆蓋），只有「HTTP 200 但查詢結果 0 筆」才維持回傳 `null`（代表真的是第一次同步、可以安全 push）。加了「🔍 疑難排解」按鈕（`showDebugStatus()` / `window.CalendarSync.showDebugStatus()`）用 `alert()` 直接顯示登入狀態、本機/雲端的 `updated_at`、行程筆數，以及本機/雲端**第一筆行程的標題與 id**（方便直接比對內容是否真的一致，不只是筆數剛好相等）。另外加了兩個手動覆蓋按鈕：「⬇️ 強制拉取雲端資料覆蓋本機」（`forcePullFromCloud()`）跳過時間比對，直接把雲端資料套用到本機並強制 `location.reload()`；「⬆️ 強制推送本機資料覆蓋雲端」（`forcePushToCloud()`）跳過時間比對，直接把本機資料整包覆蓋雲端並更新 `lastSyncedAt` 為伺服器回傳值。兩顆都有 `confirm()` 二次確認。**救資料標準流程**：當某台裝置（例如手機）曾經誤把不完整/範例資料推上雲端、蓋掉另一台的正確資料時 —— 先在資料「正確完整」的那台（例如電腦）按「⬆️ 強制推送」，把正確版本強制寫回雲端；再到被影響的那台（手機）按「⬇️ 強制拉取」把雲端正確版本拉下來。這組手動按鈕是 last-write-wins 時間判斷失準時的最終逃生口，不依賴任何 `lastSyncedAt` 狀態。
- **【根因級教訓】Service Worker 絕對不可以快取跨網域 API 請求（已修過的最大 bug）**：`service-worker.js` 的 fetch handler 原本對**所有** GET 請求 cache-first + `cache.put()`，包括 `cloudPull()` 打 Supabase 的 `GET /rest/v1/sync_state`。結果：每台裝置第一次拉雲端資料時，該回應被 SW 存進快取，**之後同一網址的每次拉取都直接回舊快取、永遠不再打網路**（POST 推送不受影響，所以雲端一直有被寫入，但誰都讀不到）。症狀千奇百怪且會互相掩護：同步顯示成功但資料不變、A 裝置推完 B 裝置立刻用舊資料蓋回去、強制拉取「拉」到的也是快取舊資料、每次 deploy 升 CACHE_NAME 後「短暫正常一次」（新快取的第一次拉取是真的）然後又壞。診斷方法：對同一 API 網址發請求，再用「參數略有不同的合法網址」（例如加 `&limit=1`）發第二次，兩者回傳的 `updated_at` 不同即證實是快取汙染。修法：fetch handler 開頭加 `if (new URL(event.request.url).origin !== self.location.origin) return;` 只攔同網域 app shell，跨網域一律直通網路；`cloudPull()` 加 `cache: 'no-store'` 雙保險；升 CACHE_NAME 清掉已汙染的快取。**規則：SW 只該快取自己網站的靜態檔案，任何動態 API 回應都不准進 Cache Storage。**
- 全新安裝（localStorage 無資料）時**保持空白，不再自動塞範例行程**：原本 `init()` 會在 `tasks` 為空時呼叫 `seedSampleTasks()` 塞一筆「規劃今日 3 件重點」每日重複範例，2026-07-16 已整個移除（函式與呼叫都刪了）。原因：範例行程曾在雲端同步實測時被新裝置誤推上雲端、蓋掉正式資料；且對新使用者不必要。
- **安裝版 PWA 一打開就 ERR_FAILED（已修過的 bug，教訓記錄）**：Cloudflare Pages 會把 `/index.html` **重新導向**到 `/`（pretty URL 行為），而 `manifest.json` 的 `start_url` 原本是 `./index.html`。SW 快取到的 `/index.html` 回應帶著 `redirected: true` 旗標，Chrome 規定「頁面導航」拒收 Service Worker 給的 redirected 回應 → 安裝到主畫面的 PWA 一啟動就 `net::ERR_FAILED`（瀏覽器直接開 `/` 反而正常，所以很難聯想）。修法（雙保險）：(1) `manifest.json` 的 `start_url` 與 `shortcuts[].url` 全改成 `./`／`./?action=...`，不再經過會被重導向的網址；(2) `service-worker.js` 加 `sanitizeResponse()`：任何 `redirected: true` 的回應先重新包成乾淨的 200 Response 再 `cache.put()`／回傳（install 階段因此改用 fetch+put，不用 `cache.add()`）。**注意：start_url 是安裝當下烙進去的，改完 manifest 後已安裝的 PWA 要移除→重新加入主畫面才會生效。**
- 測試過程曾建立測試行程與每週目標，已手動刪除。
- **2026-07-19 待辦查證**：ROADMAP 待實作 #1–#11 與第二波 Worker A–D 均已完成、無遺漏。唯二尚未確認的是「使用者自行執行」項目：(1) `schema-history.sql` 是否已在 Supabase 執行（雲端備份版本）；(2) 背景推播是否已部署（Edge Function + VAPID secrets + Cron；`config.js` 已填 `webPushPublicKey`，跡象顯示很可能已部署）。使用者自行驗證方法：開正式站登入雲端同步後，點「🕘 雲端備份版本」有列出快照＝(1) 已完成；勾「📲 背景推播提醒」能訂閱成功＝(2) 鏈路通。**→ 2026-07-22 使用者實測回報：兩項皆通過**（快照列表滿 10 份正常輪替；推播訂閱成功、測試通知按鈕出現）。唯「雲端排程推播」（Edge Function+Cron 實際到點發送）尚未做端到端實測，驗證法：設一筆 5 分鐘後提醒的行程→同步→關閉 App→等通知。

## 存檔規則

當使用者說「存檔」時，除了保存專案變更，必須同步更新這三個交接檔案：

- `HANDOFF.md`
- `CLAUDE.md`
- `AGENTS.md`

## 交接給新 agent 的第一句建議

請先讀 `HANDOFF.md`、`README.md`，再讀 `index.html` / `app.js` / `styles.css`。這是純前端本機行程表，請保持無框架、免安裝、localStorage 相容。
