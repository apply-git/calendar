# 計畫表 ROADMAP

> 總指揮：Claude Opus 4.8（只做規劃、審查、統整、修飾，不直接寫功能程式碼）
> 施工：由較低階模型（Claude Sonnet 子代理）依派工執行
> 更新日：2026-07-16

## 一、實際現況（覆寫 HANDOFF.md 的過時記載）

以 `app.js`（1273 行）實碼為準，下列功能**已完成**，不再列入待辦：

- 行程搜尋（`searchInput` + `getFilteredTasks`）
- 行程衝突提醒（`conflictWarning` + `timeOverlaps`）
- 習慣追蹤（`HABIT_KEY` + `renderHabits`，非半成品）
- 本週 / 本月完成統計（數字）
- PWA 基礎檔案已存在（`manifest.json`、`service-worker.js`、`icons/`、`start-pwa-local.bat`）

## 二、待實作項目（依簡單 → 難排序）

| # | 功能 | 難度 | 現況 |
|---|---|---|---|
| 1 | 國定假日標示 | 🟢 簡單 | 未做 |
| 2 | 完成統計圖表（長條/趨勢） | 🟢 簡單 | 只有數字 |
| 3 | 番茄鐘 / 專注計時 | 🟢 簡單 | 未做 |
| 4 | .ics（iCal）匯入 / 匯出 | 🟡 中等 | 未做 |
| 5 | 更彈性重複規則 | 🟡 中等 | 只有每天/週/月 |
| 6 | 農曆顯示 | 🟡 中等 | 未做 |
| 7 | 時間軸日檢視 + 拖曳改時長 | 🟡 中等 | 只有拖曳改日期/排序 |
| 8 | PWA 驗證與補完 | 🟡 中等 | 檔案已存在待驗證 |
| 9 | 實際推播通知 | 🟡 中等 | 只有提醒設定值 |
| 10 | 雲端同步 scaffold（Supabase） | 🔴 困難 | 未做，需使用者金鑰才上線 |
| 11 | 帳號系統 / 登入 scaffold | 🔴 困難 | 未做，綁同步 |

## 三、分工細目（總指揮派工）

| 梯次 | 執行模型 | 負責項目 |
|---|---|---|
| Worker 1 | Sonnet | #1 國定假日、#2 統計圖表、#3 番茄鐘 |
| Worker 2 | Sonnet | #4 .ics、#5 彈性重複、#6 農曆 |
| Worker 3 | Sonnet | #7 時間軸+改時長、#8 PWA 補完、#9 推播通知 |
| Worker 4 | Sonnet | #10 Supabase 同步 scaffold、#11 登入 scaffold |
| 統整 | **Opus 4.8（本人）** | 全流程審查、語法檢查、統整、修飾、更新交接檔、最終驗證 |

各 Worker **循序執行**（共用 `index.html`/`styles.css`/`app.js`，避免並行衝突），每梯次後由總指揮做 `node --check` 語法驗證。

## 四、每個 Worker 的硬性規則（沿用 CLAUDE.md / HANDOFF.md）

1. 維持純前端、免安裝、免 build，不引入框架或打包工具。
2. 不破壞現有 `localStorage` 相容性。
3. 新增資料欄位時，同步更新 `normalizeStoredData()`、`exportBackup()`、`importBackup()`、`README.md`。
4. 行程完成狀態一律用 `completedDates`，不可改回單一 `done`。
5. 重複行程一律透過 `occursOnDate(task, dateKey)` 判斷。
6. 動工前先讀現有 `app.js` / `index.html` / `styles.css`，沿用既有命名與樣式風格。
7. 完成後自我 `node --check app.js` 確認語法無誤。

## 五、進度追蹤

- [x] Worker 1：國定假日、統計圖表、番茄鐘（node --check 通過）
- [x] Worker 2：.ics、彈性重複、農曆（node --check 通過；農曆對照春節/中秋驗證正確）
- [x] Worker 3：時間軸+改時長、PWA 補完、推播通知（node --check 通過；順修既有 saveTextSettingsFromForm bug）
- [x] Worker 4：Supabase 同步 scaffold、登入 scaffold（未設定 config.js 時行為與純本機版相同，`node --check` 通過；細節見交接訊息）
- [x] 整合稽核（Sonnet）：語法/DOM 接線(116 id 全在)/腳本順序/欄位一致/無重複宣告全 PASS；補 service-worker 快取漏列的 config.js、sync.js 並升版 v2
- [x] 總指揮統整（Opus）：更新 HANDOFF/CLAUDE/AGENTS/ROADMAP、清理暫存、最終驗證

## 六、存檔規則

依 HANDOFF.md，完成後同步更新 `HANDOFF.md`、`CLAUDE.md`、`AGENTS.md`（及本 `ROADMAP.md`、`README.md`）。
