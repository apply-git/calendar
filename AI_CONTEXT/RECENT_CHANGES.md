# Recent Changes

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

## 尚未實作（另案，見 ROADMAP.md §十）
Google Calendar 整合、時區旅行模式、專案任務依賴、錯誤紀錄自動上報、無障礙全面審查。

## 使用者待辦（已完成，供留存）
`schema-history.sql`（雲端備份版本）與 `schema-share.sql`（家庭共享）皆已在 Supabase 執行並實測通過；家庭共享後續只需把邀請碼傳給家人即可加入。
