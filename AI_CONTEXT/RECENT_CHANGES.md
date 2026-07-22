# Recent Changes

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
