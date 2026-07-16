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
| `manifest.json` / `service-worker.js` / `icons/` / `start-pwa-local.bat` | PWA 安裝與離線快取（需本機伺服器）。`icons/` 內含正式圖示（icon-192/icon-512/icon-maskable-512/apple-touch-icon/favicon-64，皆圓角）與 `icon-master-1024.png` 母檔備用；`service-worker.js` 快取版本 v4。 |
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

`appSettings`（`desktop-schedule-app-settings-v1`）新增欄位 `autoSync`（布林，預設 `false`）：是否開啟「存檔時自動同步到雲端」。這個欄位**有**跟著 `appSettings` 整包走 `normalizeStoredData()` / `exportBackup()` / `importBackup()`。

task 物件新增欄位 `excludedDates`（字串陣列，預設 `[]`）：儲存「這筆（通常是重複）行程被排除、不顯示」的日期字串清單，供「🗑 清空當日」功能使用。`occursOnDate(task, dateKey)` 一開始就會檢查 `excludedDates` 是否包含 `dateKey`，包含就直接回傳 `false`（蓋掉所有重複規則判斷）。`normalizeStoredData()` 會幫舊資料補上空陣列；`buildBackupPayload()` / `applyBackupObject()` 是整包序列化/還原 `tasks` 陣列，`excludedDates` 會自動跟著 task 物件走，不需要額外程式碼。

## 已完成功能

- 手機版排版大改（斷點 `max-width: 760px`，桌面版一像素都不受影響，所有規則都包在這個 media query 或 `matchMedia('(max-width: 760px)')` 判斷內）：`.app-shell` 在此斷點改 `display:flex;flex-direction:column`，`.main { order: 1 }`／`.sidebar { order: 2 }` 讓行事曆本體排到最前面，側邊欄排到後面。`app.js` 新增 `setupMobilePanels()`（在 `init()` 裡 `bindEvents()` 之後呼叫一次，只在 `matchMedia` 命中手機時才動作，不監聽 resize）：幫每個 `.sidebar .panel`、動態插入標題的 `.controls`（搜尋/篩選區）、`.daily-memo`（沿用既有 `.daily-memo-head` 當標題列）加上 `collapsible` class 與預設的 `collapsed` class，並在各自的標題列元素（統一加上 `panel-collapse-head` class）綁 click 切換 `collapsed`；CSS 用 `.panel.collapsible.collapsed > *:not(.panel-collapse-head) { display:none }` 隱藏內容，標題用 `::after` 顯示 ▸（收合）／▾（展開）。新增 `#fabAddBtn`（`.fab-add`，右下角圓形懸浮＋號）：桌面版 CSS 固定 `display:none`、HTML 帶 `hidden`，只有手機模式時 JS 移除 `hidden`、CSS 用 `.fab-add:not([hidden])` 才真的顯示（避免 CSS 蓋掉 `hidden` 屬性），click 呼叫既有的 `openTaskDialog()`。工具列新增 `#moreToolsBtn`（同樣預設 `hidden`，手機才顯示）與 `#moreToolsDialog`：手機上把次要工具鈕（🔔 開啟通知、備份、還原、文字設定、🍅 番茄鐘、小工具模式、清理舊行程、匯出 Excel/PDF/.ics、匯入 .ics）用 id 列舉 `display:none !important` 藏起來，改收進 `moreToolsDialog` 裡一排 `data-proxy="原按鈕id"` 的 proxy 按鈕，點下去先 `moreToolsDialog.close()` 再對原按鈕呼叫 `.click()`，不用搬動任何原有按鈕或邏輯。`dialog.task-dialog` 在此斷點改 `width:100%;margin:auto 0 0 0;border-radius:20px 20px 0 0;max-height:88vh;overflow-y:auto`，變成貼齊底部彈出、可捲動。`service-worker.js` 的 `CACHE_NAME` 因此從 `v13` 升到 `v14`。
- 年月日直選跳轉：導航列有 📅 按鈕（`#jumpDateBtn`）＋隱藏的 `<input type="date">`（`#jumpDateInput`，樣式 `.date-jump`）。支援 `showPicker()` 的瀏覽器會把輸入框加上 `.picker-hidden`（1px 透明、absolute，**不能用 display:none 否則 showPicker 會失效**），點 📅 或點日期標題（`#currentTitle`）開啟原生年月日選擇器；不支援的舊瀏覽器則反過來顯示小輸入框、隱藏 📅 按鈕。選定日期直接跳到該天（週/月檢視跳到含該日的週/月），`renderTitle()` 同步 `jumpDateInput.value`。行程視窗的日期欄（`#taskDate`）點整個欄位即開啟選擇器。教訓：`.date-jump` 必須設 `width:auto` 蓋掉全域 `input { width:100% }`，否則會撐開導航列把標題擠成直排。
- 新增 / 編輯 / 刪除行程
- 日 / 週 / 月檢視
- 完成勾選
- 重複行程：每天 / 每週 / 每月
- 重複行程每日獨立完成
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
- 背景推播提醒 scaffold（Web Push，**進階選用功能，預設停用零影響**）：`config.js` 沒填 `webPushPublicKey` 時，`push.js`（新檔案，`index.html` 在 `sync.js` 之後多載入一行 `<script src="push.js"></script>`）最上面就 `return`，不插入任何 UI、不註冊事件、不打任何網路請求，跟加入這個功能之前完全一樣。設定好之後：「☁️ 雲端同步」對話框登入區（`#cloudSyncLoggedInBox`）會動態插入一個「📲 背景推播提醒」勾選框＋狀態小字（用 `MutationObserver` 跟著 `#cloudSyncLoggedInBox` 的 `hidden` 屬性變化即時刷新狀態，不用改 `sync.js` 既有的 `updateUI()`）；勾選會走 `Notification.requestPermission()` → `pushManager.subscribe()` → upsert 到 Supabase 的 `push_subscriptions` 表，取消勾選則 `unsubscribe()` ＋刪除該筆雲端訂閱紀錄；未登入雲端時 checkbox disabled 並顯示「請先登入雲端同步」，不支援的瀏覽器（偵測 `PushManager`、`file://` 一律視為不支援）顯示「此瀏覽器不支援背景推播」。`sync.js` 只新增一個匯出 `window.CalendarSync.getAuthState()`（回傳目前登入狀態的淺拷貝，供 `push.js` 讀取 access token／user id，沒有動任何既有函式）。`service-worker.js` 新增 `push`／`notificationclick` 兩個事件（未動 `CACHE_NAME` 與既有 `install`/`activate`/`fetch`）：收到推播用 `showNotification()` 顯示（解析失敗用預設文字），點通知會 focus 既有視窗或開新視窗。伺服器端由新檔案 `schema-push.sql`（`push_subscriptions` 存訂閱、`push_sent_log` 防重複通知，皆有 RLS，`push_sent_log` 刻意不開任何 policy，只讓 service_role 讀寫）與 `supabase/functions/send-reminders/index.ts`（Deno Edge Function，用 service_role 讀 `sync_state` 全部使用者的 payload，對「今天出現、有設提醒分鐘數、提醒時刻落在執行窗口內、未完成」的行程用 `npm:web-push` 發送，簡化移植 `occursOnDate()` 判斷重複規則，時區依 `TZ` 環境變數預設 `Asia/Taipei`，過期訂閱 404/410 自動清除）組成，皆需**使用者自行**依 `CLOUD_PUSH_SETUP.md` 部署（產生 VAPID 金鑰、跑 SQL、`supabase functions deploy`、設定 secrets、設定 Supabase Cron 排程），未部署也完全不影響前端任何功能。
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

## 後續可製作方向

### PWA 版（已完成，待實測）

`manifest.json` / `service-worker.js` / `icons/` / 離線快取 / README 教學皆已完成。
仍待做：透過 `start-pwa-local.bat` 本機伺服器實際安裝到手機/電腦跑一輪確認。

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

## 存檔規則

當使用者說「存檔」時，除了保存專案變更，必須同步更新這三個交接檔案：

- `HANDOFF.md`
- `CLAUDE.md`
- `AGENTS.md`

## 交接給新 agent 的第一句建議

請先讀 `HANDOFF.md`、`README.md`，再讀 `index.html` / `app.js` / `styles.css`。這是純前端本機行程表，請保持無框架、免安裝、localStorage 相容。
