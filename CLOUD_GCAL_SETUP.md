# Google 日曆唯讀匯入設定（G1）

把 Google 日曆上的活動抓進行程表顯示。**唯讀**：匯入的活動不能在 App 內編輯、刪除、
拖曳或勾選完成，也永遠不會寫回 Google。

沿用既有的 Google 登入（Supabase Auth），**不需要另外建立 OAuth 用戶端**。

---

## 一、Google Cloud Console（一次性，做過就不用再做）

專案：`My Project calendar`（`my-project-calendar-502607`）——就是既有 Google 登入
用的那個專案。**不要動**「用戶端」底下的重新導向 URI
`https://uaentjtgdrzbzfkccybs.supabase.co/auth/v1/callback`，那是登入功能在用的。

1. **啟用 Calendar API**
   <https://console.cloud.google.com/apis/library/calendar-json.googleapis.com?project=my-project-calendar-502607>
   → 點「啟用這個 API」，狀態變成「已啟用」即可。

2. **加入唯讀權限範圍**
   <https://console.cloud.google.com/auth/scopes?project=my-project-calendar-502607>
   → 「新增或移除範圍」→ 手動貼上 `https://www.googleapis.com/auth/calendar.readonly`
   → 新增至資料表 → 更新 → 儲存。
   只加 readonly，**不要加** `auth/calendar`（可寫），否則就失去「不可能改壞 Google 日曆」的保證。

3. **發布狀態確認**
   <https://console.cloud.google.com/auth/audience?project=my-project-calendar-502607>
   目前是「實際運作中」（已發布），不需要測試使用者名單。
   授權時會出現「未經驗證的應用程式」警告 → 進階 → 前往 calendar（不安全），這是未送審的正常行為。
   未核准的機密範圍有「累計 100 位授權使用者」上限，自用足夠。

頁面上的「送交驗證 / 驗證中心 / 您預計如何使用這些範圍」都是要上架給陌生人用才需要，**跳過**。

## 二、使用方式

1. 開啟行程表 → 工具列「☁️ 雲端同步」。
2. 若已登入，先**登出再重新用 Google 登入一次**——舊的登入沒有日曆權限，
   要重跑一次授權才會拿到 `provider_token`。授權畫面會多出「查看您的日曆」。
3. 回到雲端同步視窗，找到「📆 Google 日曆匯入（唯讀）」區塊。
4. 選「匯入區間」→ 按「匯入 Google 日曆」。

### 匯入區間選項

| 選項 | 範圍 |
|---|---|
| 前一個月～後三個月（預設） | 今天往前 1 個月 ～ 往後 3 個月 |
| 僅未來一個月 | 今天 ～ 往後 1 個月 |
| 前後各三個月 | 今天往前 3 個月 ～ 往後 3 個月 |
| 今年整年 | 1/1 ～ 12/31 |

選擇會記在本機（`desktop-schedule-gcal-v1`），下次開啟沿用。

## 三、行為與限制

- 匯入的行程 id 一律是 `gcal-<Google 活動 id>`、`source: 'gcal'`、分類固定「Google 日曆」
  （分類不存在時自動補一筆，顏色 `#4285f4`，之後你改顏色不會被覆蓋）。
- **重新匯入＝整批更新**：這次區間內沒再出現的舊匯入會被標記刪除（留墓碑供雲端同步收斂），
  重複的活動以 Google 為準覆蓋，不會產生第二筆。
- 重複性活動由 Google 端展開成一筆一筆的實例（`singleEvents=true`），
  行程表這邊一律存成 `repeat: 'none'`。
- 全天活動只取起始日，沒有起訖時間；跨日的有時段活動，結束時間夾成當日 `23:59`。
- 匯入行程 `reminder: -1`（不提醒），避免一次匯入幾百筆就灌爆通知。
- 單次上限 500 筆。超過請改用較短的區間。
- `provider_token` 約 1 小時到期。過期後匯入會提示「授權已過期」，
  登出再重新登入即可；權杖只存在本機 localStorage，**不會**進備份 JSON、不會被匯出或分享。
- 匯入結果會進 `tasks`，所以也會隨雲端同步/備份帶到其他裝置——這是刻意的，
  讓各裝置看到一致的畫面，不必每台都重跑一次匯入。

## 四、相關檔案

| 檔案 | 職責 |
|---|---|
| `gcal.js` | 授權權杖保管、區間計算、Calendar API 讀取、Google 活動→行程對應、匯入 UI |
| `app-08-data.js` | `replaceGcalTasks()` / `ensureGcalCategory()`——唯一會動 `tasks` 的地方 |
| `sync.js` | 登入時帶 `calendar.readonly` scope、把 `provider_token` 交給 `gcal.js`、登出時清掉 |
| `app-05-dialogs.js` | `openTaskDialog()` 唯讀擋門（連帶擋掉刪除） |
| `app-06-taskform.js` | 拖曳／勾選完成的唯讀擋門 |
