# 世代總覽（Generations）— 給 Claude Code／Codex 的完整交接

> 本檔是「初代（001）／二代（002）／目前主線」的權威總覽：每代的完整架構、包含內容、
> 與預計要施作的功能。要修改或延伸本專案，先讀這份＋`PROJECT_BRIEF.md`（事實）＋
> `NOTES.md`（踩坑鐵則），再動工。世代快照本體在 `versions/行事曆-NNN/`，
> **一旦建立絕不覆蓋、絕不刪除**（NOTES 第 11 條）。

## 0. 專案不變的骨架（所有世代共通）

- Vanilla HTML/CSS/JS、無框架、無 npm、無 build；`file://` 雙擊 `index.html` 可用。
- 資料真相在瀏覽器 localStorage（key 清單見 `PROJECT_BRIEF.md`）；附件在 IndexedDB。
- PWA：`manifest.json`＋`service-worker.js`（APP_SHELL 檔案有異動必升 `CACHE_NAME`）。
- 雲端（皆選配，config.js 空值時整個 no-op）：Supabase `calendar-gogo`
  （`uaentjtgdrzbzfkccybs.supabase.co`）——Google 登入、逐筆同步、備份版本、
  家庭共享、Web Push 推播、（002 後）Google 日曆唯讀匯入。
- 部署：push GitHub `apply-git/calendar` main → Cloudflare Pages 自動部署
  → https://calendar88.pages.dev/ 。沙盒無外網，**push 一律由使用者在本機執行**。
- 版本對應：`versions/行事曆-NNN/` ↔ 頁尾版號 `0.0NN`（002 代＝0.002）。

## 1. 初代：行事曆-001（快照 2026-07-22，含第一～四波全部成果）

**架構**：單檔 `app.js`（約 5239 行）＋ `index.html`／`styles.css`／`sync.js`／
`config.js`／`push.js`／`service-worker.js`／`schema*.sql`（4 份）／`supabase/functions/send-reminders`。

**包含能力**（詳見 `versions/行事曆-001/README.md`）：
- 基礎行事曆全套：日/週/月/列表檢視、優先度、分類與自訂色、子任務、範本、標籤、
  置頂、逾期標紅、備忘錄、每週目標、習慣追蹤 streak、深淺色主題、文字自訂。
- 重複行程完整體系：每日/週/月/隔N天/工作日/每月第幾個週幾/農曆每年；
  逐日獨立完成（`completedDates`）；單次覆寫與「這次及之後」；`excludedDates` 排除。
- 進階功能：時間軸日檢視（拖曳改時長）、衝突偵測、拖曳改日期/排序、Ctrl+K 命令面板、
  進階統計儀表板、番茄鐘、批量貼上匯入、⚡找空檔、⏭未完成順延工作日、
  🩺資料檢查修復、分享圖卡、掛牆看板模式、App Badge、PWA Share Target。
- 匯出入：JSON 備份/還原（可 AES-GCM 密碼加密）、CSV、.ics 雙向、列印。
- 台灣在地：國定假日（靜態 2025–2027＋連網自動更新）、農曆顯示（1900–2100）、
  Open-Meteo 天氣（預設高雄）。
- 雲端：Google 登入、**逐筆合併同步**（pull→merge→push，`mergeBackupPayloads()`，
  墓碑 `deletedAt` 90 天清除，取代整包 LWW）、雲端備份 10 份快照、
  家庭共享群組（邀請碼、`task.shared`、RLS）、背景推播（VAPID＋Edge Function）、
  行程附件（IndexedDB，單檔≤5MB、每筆≤10 個，不進備份/雲端）。

## 2. 二代：行事曆-002（快照 2026-07-30，第五波；快照後主線又完成 G1）

**架構重整（R1）**：`app.js` 依頂層宣告邊界**純搬移**拆成 9 檔，依序載入、
共用同一全域作用域（⚠ 同名頂層 function 後者靜默覆蓋前者——NOTES 第 16 條）：

| 檔 | 職責 |
|---|---|
| app-01-core.js | 常數/localStorage key/預設值/全域 state（tasks、categories、okrs…） |
| app-02-init.js | init()、DOM 快取 els、FAB/自然語言快建 |
| app-03-events.js | 事件綁定/委派、命令面板、OKR 事件 |
| app-04-render.js | render() 總入口（含 saveJson 落地＋onDataChanged 掛勾）、各檢視渲染 |
| app-05-dialogs.js | 各對話框（openTaskDialog **唯一**編輯入口、OKR、分類…） |
| app-06-taskform.js | 表單存檔 saveTaskFromForm、拖曳、勾選完成 handleCalendarChange、附件 UI |
| app-07-reminders.js | 提醒/通知/snooze/番茄鐘 |
| app-08-data.js | 資料層：occursOnDate、touchTask/tombstoneTask、備份 build/apply、replaceGcalTasks |
| app-09-entry.js | 錯誤上報、資料檢查、`window.CalendarApp` 匯出 |

**第五波新增**：D1–D4（自訂色/地點、多日曆本、任務依賴 dependsOn、時區＋旅行模式）、
V1–V3（年檢視熱力圖、甘特圖、列印友善）、M1–M3（手勢、底部導航、快速新增列）、
S1–S4（找空檔建議、早晚週摘要推播 Cron、snooze 雲端化、錯誤自動上報）、
P1–P2（心情追蹤、番茄鐘統計）、P3（目標 OKR 手動進度版）、G2（無障礙全面修正）、
自製圖示全面取代系統 emoji（VS16 踩坑—NOTES 第 14 條）、手機標題切換。

**快照後主線繼續完成（2026-08-07，屬 002 世代尾聲、將滾入 003）**：
- **G1 Google 日曆唯讀匯入**：`gcal.js`（權杖/區間/API/對應）＋
  `replaceGcalTasks()`（app-08，唯一動 tasks 入口）；OAuth 只要 `calendar.readonly`；
  區間下拉預設「前一個月～後三個月」；唯讀鎖在 openTaskDialog/拖曳/勾選三個唯一入口；
  設定教學 `CLOUD_GCAL_SETUP.md`；Google Cloud 專案 `my-project-calendar-502607` 已開通。
- 修既有 `habitStreak()` 重複定義（死碼移除，零行為變更）。
- 現況：`CACHE_NAME` v44、tests.html 77 案例、commit `f5dc682`。

**002 相對 001 的檔案增減**：＋`app-01..09.js`（取代單檔 app.js）、＋`gcal.js`、
＋`schema-errorlog.sql`、＋`tests.html`、＋`start-pwa-lan.bat`/`_lan_server.py`（區網預覽，
non-secure-origin 踩坑見 NOTES 第 13 條）、＋`CLOUD_GCAL_SETUP.md`。

## 3. 預計要施作（未來波次的候選清單）

依既有討論的優先序；每項動工前先跟使用者確認規格：

1. **P3 後半：OKR「行程貢獻自動算」**——目前 OKR 進度是手動輸入；
   規劃讓完成的行程（依分類/標籤對應）自動累進 key result 進度。
2. **G1 延伸**：多日曆選擇（目前只抓 primary）、自動定期重新匯入、
   token 過期時的靜默重授權提示優化。
3. **存新版 003**：使用者驗收 G1 線上功能後喊「存新版」→ 建 `versions/行事曆-003/`
   ＋頁尾 0.003（步驟見 CLAUDE.md 觸發短語；核心檔清單以 002 實際內容為準，
   即 app-01..09.js＋gcal.js，非舊的單檔 app.js）。
4. **使用者尚未執行的選配部署**（功能已寫完，等使用者跑）：
   S2 早晚週摘要的 3 條 Supabase Cron（`CLOUD_PUSH_SETUP.md` 步驟六之二）、
   S4 `schema-errorlog.sql`（選用）。
5. **長期另案**（尚無規格，僅記錄意向）：更細的重複規則例外編輯 UI、
   同步衝突可視化 UI、OKR 季度回顧報表。

## 4. 開發流程速記（兩個 CLI 都適用）

- 觸發短語「存檔／推送／存新版」定義在 `CLAUDE.md`（Claude Code）／`AGENTS.md`（Codex），
  兩份紅線一致：不引框架、資料欄位四同步、completedDates、CACHE_NAME、
  UI 改動先預覽、具名 git add、繁中回覆、開工前自檢環境。
- 測試：改純函式必補 `tests.html` 案例；本機開 tests.html 須 ALL PASS 才算完。
- 掛載區限制：不能 rm/unlink——垃圾（git 鎖檔等）一律 mv 進 `_to_delete/`。
- 已推送的 commit 絕不 amend（rebase/force push 禁止；要改就疊新 commit）。
