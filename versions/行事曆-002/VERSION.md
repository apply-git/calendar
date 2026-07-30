# 行事曆-002（第五波）

快照時間：2026-07-30

## 這一代包含的能力

在 001（初代）的完整基礎上，第五波新增／完成：

- **R1 架構重整**：原本單一 5239 行的 `app.js` 依頂層宣告邊界純搬移拆成 9 個依序載入的檔案（`app-01-core.js`…`app-09-entry.js`），共用同一份全域作用域，行為與拆分前完全一致。
- **資料層強化（D1–D4）**：行程自訂色彩／地點欄位、多日曆本（分本／疊加顯示）、專案任務依賴（前置任務未完成擋勾選）、行程時區＋旅行模式換算顯示。
- **新檢視（V1–V3）**：年檢視（全年熱力圖）、甘特圖／專案時間軸、列印／PDF 友善輸出。
- **手機體驗（M1–M3）**：手勢操作（滑動切月週、左右滑完成/延後、長按快建）、底部導航列、快速新增列＋震動回饋。
- **智慧與雲端（S1–S4）**：⚡ 找空檔智慧建議（依習慣時段）、早／晚／週摘要推播（Supabase Edge Function＋Cron，使用者需自行部署）、snooze 延後動作雲端化（併入同步 payload）、錯誤紀錄自動上報（進階選用，需使用者執行 `schema-errorlog.sql`）。
- **個人化（P1–P2）**：心情追蹤（月曆疊加＋統計整合）、番茄鐘統計強化（近 30 天總量＋近 7 天每日分佈）。
- **無障礙全面修正（G2）**：全站按鈕／輸入框補齊 `aria-label`，13 個對話框補 `aria-labelledby`，逾期／倒數清單支援鍵盤操作，修正指令面板鍵盤焦點框被覆蓋的問題。
- **整合稽核與收尾（G3）**：測試跑道 tests.html 由 48 案例增至 54（新增心情/番茄鐘統計測試，並修正一個過期的備份 roundtrip 測試 fixture）；`CACHE_NAME` 統一升版至 v35；文件（README／ROADMAP／AI_CONTEXT）同步更新。

詳細功能清單見同資料夾 `README.md`；程式邏輯細節見主專案 `AI_CONTEXT/NOTES.md`、`ROADMAP.md`、`AI_CONTEXT/RECENT_CHANGES.md`。

## 尚未完工、留給下一波

- **P3 目標 OKR**（月／季目標＋行程貢獻＋進度條）——規格未定案，尚未開工。
- **G1 Google Calendar 唯讀匯入**——需使用者先在 Google Cloud Console 開通 Calendar API＋OAuth 同意畫面，尚未開工。

## 這份快照不包含

`AI_CONTEXT/`、`ROADMAP.md`、`CLAUDE.md`、`AGENTS.md`（開發用交接文件，只在主專案根目錄維護，不隨版本重複）、`tests.html`（測試跑道，開發工具非產品功能）、`_to_delete/`（git 鎖檔暫存，環境雜訊）。

## 使用者仍需自行完成的部署步驟

- S2：Supabase SQL Editor 額外建立 3 條 Cron（早／晚／週摘要），並在 App「☁️ 雲端同步」對話框勾選對應開關後同步一次——見 `CLOUD_PUSH_SETUP.md`「步驟六之二」。
- S4：Supabase SQL Editor 執行 `schema-errorlog.sql`（選用，不執行不影響其他功能）。
- G1（下一波）：Google Cloud Console 啟用 Calendar API＋OAuth 同意畫面加 scope。
