# Recent Changes

## 2026-08-09 新增使用教學：首訪歡迎卡片＋完整教學頁 guide.html
- **歡迎卡片**（`#welcomeDialog`）：首次進入自動彈出，六大分類簡易教學（新增行程／切換檢視／重複行程／提醒通知／統計追蹤／備份同步），每類一張自繪 inline SVG（不用系統 emoji 當圖示，NOTES 14）。底部「不再顯示」勾選 → 寫 `desktop-schedule-welcome-v1='1'`；不勾就關則下次仍跳。裝置本機旗標，**不進備份、不進雲端**
- 隨時可重開：⋯更多 › 設定與維護 › 「📖 使用教學」
- **`guide.html`**（新檔，71KB）：九章完整教學（基本操作／六種檢視／重複行程／分類標籤優先度日曆本／提醒與專注／進階工具／統計與追蹤／資料與雲端／手機與 PWA），每章＝說明＋一張獨有 inline SVG＋figcaption＋實際範例。自我包含零外連、`file://` 可開、沿用 styles.css 變數並讀 theme key 跟隨深淺色、375px 無橫向溢出（寬表格包 `.table-wrap` 自捲）
- `service-worker.js`：`guide.html` 加進 APP_SHELL（離線可查），`CACHE_NAME` v46→v47
- 新增三個頂層函式 `maybeShowWelcome`／`openWelcomeDialog`／`closeWelcomeDialog`，撞名掃描 315 個頂層函式 0 衝突
- **子代理回報有誤、已由主代理修正**：guide.html 原稿漏掉「家庭共享」整節（子代理只 grep `app-0*.js` 沒 grep `sync.js`，誤判該功能不存在）。已補上邀請碼流程與「行程需逐筆勾共享」的說明＋範例
- **剩什麼**：`file://` 實測被預覽面板擋住（http→file 導航瀏覽器禁止），改以「零外連＋僅相對路徑」的結構證據佐證；有機會請在本機雙擊 `index.html` 實際確認一次

## 2026-08-08 手機版版面重排（桌機零變動）
- 起因：使用者回報手機版面亂、且「⋯更多」與頂部工具列有重複選項。查出根因——`app-02-init.js` 註解宣稱手機會用 CSS 把 `.toolbar-actions` 整組隱藏，**實際那條規則不存在**；真正在管的是 `styles.css` 手機 media query 內的 id 隱藏清單，而第五波新增的 `#okrBtn`/`#calendarsBtn`/`#printViewBtn` 漏加，導致頂部與更多視窗各有一份
- 頂部工具列 394px→**235px**：只留 日期導覽／清單·時間軸／🗑清空當日／🌙／☁️雲端同步／今日待辦／⋯更多（使用者指定保留到「今日待辦」）；主 `.view-switch` 手機隱藏，改由底部導航列負責，底部沒有的「年／甘特」在更多視窗補入口（`data-view-proxy`，因 `.view-btn` 只有 `data-view` 沒有 id）
- 「⋯更多」22 項平舖 → **5 組收合下拉**（檢視與模式／分析與追蹤／行程工具／匯出入與備份／設定與維護），一次只展開一組；點選仍是原本的 proxy 行為（關面板→原按鈕 .click()→原卡片視窗照跳），功能邏輯零改動
- 行事曆下方七個側欄面板改**雙欄收合卡** 626px→**314px**（展開中的那格自動跨整行）；搜尋與篩選／每日備忘錄／行程表位置與順序不動
- 全部新規則鎖在 `@media (max-width: 760px)`；桌機 1280px 實測：側欄仍 flex 單欄、檢視切換正常、更多視窗組標題隱藏且 27 項全展開＝與分組前平舖清單一致
- `CACHE_NAME` v45→v46；tests.html 80/80 全過。踩坑寫入 NOTES 第 18 條
- **剩什麼**：截圖工具在本次 session 不穩（面板反覆收起），「日檢視最底部雙欄面板區」那張未拍到，其餘已預覽確認

## 2026-08-08 全專案架構稽核＋四項修正（倉庫衛生／開發文件不外洩／文件校正／lastSyncedAt 收斂）
- 稽核結論：核心程式碼無功能性 bug——312 個頂層函式 0 同名衝突、APP_SHELL 與 index.html script 順序一致、備份 `buildBackupPayload`/`applyBackupObject` 欄位對稱、SW 跨網域護欄在。問題集中在倉庫衛生與文件過時
- 倉庫衛生：刪掉誤入 git 的 `_we_test.js`/`_wf_check.js`（0 byte 空檔）、`里程碑總表_2026-07-21.docx` 移出追蹤（本機保留）、`.gitignore` 加 `*.docx`；順手清 `send-reminders/index.ts` 對已刪檔的懸空註解
- 新增 `_redirects`：18 條 302，擋掉開發文件從正式站被直接讀取（輸出目錄是 `/`＝整包 repo 都被部署）。原本想回 404，官方明列不支援，改用「重定向優先於實體檔案」達成——完整踩坑見 NOTES 第 17 條
- `sync.js` lastSyncedAt 收斂到唯一入口 `saveServerSyncedAt()`：伺服器沒回有效時間就「不更新」，不再退回 `Date.now()`（原本 5 個呼叫點各留一個 fallback 破口），順帶擋掉 NaN；`CACHE_NAME` v44→v45，tests 77→80 全過
- 文件校正：PROJECT_BRIEF 主要檔案表改成九檔架構＋標明各函式落點並補 `_redirects`；GENERATIONS 修正「備份 build/apply」誤植在 app-08（實際在 app-07）；RECENT_CHANGES 檔尾「尚未實作」改「已銷案」
- **剩什麼**：`_redirects` 只驗過語法與「沒擋錯 APP_SHELL」，實際效果需部署後線上 curl 確認；其餘見 GENERATIONS.md §3（P3 行程貢獻自動算、G1 延伸、存新版 003、S2 Cron／S4 SQL 待使用者跑）

## 2026-08-07 新增 AI_CONTEXT/BOOTSTRAP_PROMPTS.md 開機提示詞
- Claude Code／Codex 各一份「開新 session 第一則訊息」範本（讀取順序＋回報格式＋三條硬性提醒），兩份除規則檔名外內容一致；CLAUDE.md/AGENTS.md 先讀鏈已加指引

## 2026-08-07 新增 AI_CONTEXT/GENERATIONS.md 世代總覽交接檔
- 001/002 完整架構與能力、G1 完工現況、未來波次候選清單（P3 行程貢獻自動算／G1 延伸／存新版 003／使用者待部署項）全部集中一份，Claude Code 與 Codex 的先讀鏈（CLAUDE.md/AGENTS.md）已加入指引
- 併修 CLAUDE.md/AGENTS.md「存新版」核心檔清單過時問題：app.js 時代清單更新為 002 實況（app-01..09.js＋gcal.js＋tests.html＋lan 預覽檔＋CLOUD_GCAL_SETUP.md）

## 2026-08-07 G1 Google 日曆唯讀匯入完工（本機 commit 未 push）
- 新增 `gcal.js`（區間計算／Calendar API events.list／活動→行程對應／匯入 UI）＋`CLOUD_GCAL_SETUP.md`；`app-08-data.js` 新增 `replaceGcalTasks()`/`ensureGcalCategory()` 為唯一動 tasks 入口
- 唯讀鎖定改在既有唯一入口：`openTaskDialog()`（含刪除）、拖曳、勾選完成三處擋 `source==='gcal'`；`sync.js` 登入帶 `calendar.readonly` scope、收 `provider_token`、登出清除
- 匯入區間預設「前一個月～後三個月」，另有僅未來一個月／前後三個月／今年整年；CACHE_NAME v43→v44；tests.html 61→77 案例
- 順手修既有問題：`app-08-data.js` 的 `habitStreak()` 有兩份同名實作（後者靜默覆蓋前者），移除死碼版本並補 5 條回歸測試；全專案 306 個頂層函式已掃過，無其他同名衝突

## 2026-07-30 第五波 002 持續微調＋P3 完工：全自製導航圖示、手機標題、OKR 目標追蹤（本機多個 commit 未 push）
- 品牌大圖示／選日期／底部導航（日週月/列表/今天）全部改自製圖示（不再吃各平台 emoji 字型）並修正置中；手機寬度標題自動顯示「手機行程表」
- P3 目標 OKR 完工（4 包）：okrs 資料層+CRUD+進度計算、okrDialog 介面、tests.html 61 案例；CACHE_NAME v35→v43；CLAUDE.md 補「存新版」footer 同步步驟＋「存檔」交接檔改固定動作。G1 Google Calendar 匯入尚未開工

## 2026-07-30 第五波 002 收尾微調：天氣圖示彩色化＋全自製介面圖示（本機 5 個 commit 未 push）
- 天氣 emoji 補 VS16（6 種原本在 Windows 退回單色）並放大到 16px；頁尾版號 0.002；品牌大圖示改用 icons/icon.svg，選日期按鈕改自繪日曆卡並由 render() 依 currentDate 更新月份/日期
- CACHE_NAME v35→v37；README 補第 51 項；versions/行事曆-002 快照與 VERSION.md 同步。P3 目標 OKR、G1 Google Calendar 匯入仍未開工

## 2026-07-29 第五波 002：W4-W6 收尾（G2 完成、G3 進行中，本機 commit 未 push）
- ROADMAP 補打勾 S1-S4/P1/P2（程式碼確認已實作，S2/S4 待使用者跑部署/SQL）；G2 無障礙全面修正（aria-label/aria-labelledby/aria-current、鍵盤可達性、指令面板焦點框）
- tests.html 補 computeMoodStats/computePomodoroStats，48→54 案例；CACHE_NAME v33→v35。P3 目標 OKR、G1 Google Calendar 匯入尚未開工

## 2026-07-22 第五波 002：W0–W3 完工（本機 commit、未 push、CACHE_NAME 未動）
- W0 R1：app.js 拆 9 檔循序載入（app-01-core～app-09-entry，純搬移）；CACHE_NAME → v32
- W1 資料層：D1 自訂色彩+地點、D2 多日曆本、D3 任務依賴、D4 時區旅行模式；W2 檢視：V1 年熱力圖、V3 列印、V2 甘特圖
- W3 手機：M1 手勢（滑動切月週、行程卡左滑完成/右滑順延、長按快建）、M2 底部導航列、M3 快速新增列+震動。HEAD 63abb57，待手機預覽後續作 W4

## 2026-07-22 記憶瘦身
`HANDOFF.md`（51KB，單行常破千字）拆分為 `PROJECT_BRIEF.md`/`NOTES.md`/`RECENT_CHANGES.md`，`CLAUDE.md`/`AGENTS.md` 精簡到只留紅線+指標。全文備份於 `HANDOFF.md.full.bak`（未進 git，本機保留），原檔已刪除；更早的歷史一律以 `git log` 與 `ROADMAP.md` 為準。

## 2026-07-22 第四波：逐筆同步＋家庭共享＋附件（7 包）
- task 加 `updatedAt`/`deletedAt` 墓碑，同步改 pull→merge→push 雙向逐筆合併（`mergeBackupPayloads()`）
- 家庭共享：`schema-share.sql`（3 表+RLS+security definer 防遞迴）、群組建立/邀請碼加入/退出、`syncSharedTasks()`
- 行程附件：IndexedDB（單檔 5MB、每筆 10 個），不進備份與雲端
- 小尾巴：提醒延後（snooze）持久化重開頁面補發、農曆重複行程匯出 .ics 展開未來 5 年
- 測試跑道固化 48 案例全過；`CACHE_NAME` → v31

## 2026-07-22 第三波：全速施工＋工具列改版（13+2 包）
測試跑道/資料檢查/錯誤紀錄/SW 更新提示、App Badge/習慣 streak、批量新增/找空檔、Share Target/順延工作日、命令面板/統計儀表板/通知互動、農曆重複/天氣/假日更新/加密備份、UI polish/分享圖卡/看板模式；後續再改版桌面工具列為六組下拉選單（⚡檢視動作/🖥模式/🧰工具/📊分析/📤匯出入/⚙設定）。過程修過兩個 bug：TDZ 導致 `render()` 沒跑、`overflow:hidden` 裁切下拉選單（詳見 NOTES.md #4、#5）。`CACHE_NAME` → v27→v28。

## 已銷案（原「尚未實作」清單，五項均已在第五波 002 完工）
Google Calendar 整合＝G1、時區旅行模式＝D4、專案任務依賴＝D3、錯誤紀錄自動上報＝S4（程式已完成；`schema-errorlog.sql` 為選用，待使用者執行）、無障礙全面審查＝G2；均已實作並上線，詳見上方各波紀錄與 `GENERATIONS.md`。

## 使用者待辦（已完成，供留存）
`schema-history.sql`（雲端備份版本）與 `schema-share.sql`（家庭共享）皆已在 Supabase 執行並實測通過；家庭共享後續只需把邀請碼傳給家人即可加入。
