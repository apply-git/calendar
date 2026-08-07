# Notes — 踩坑鐵則

1. **Service Worker 只准快取同網域靜態檔，絕不可快取跨網域 API**。曾經 cache-first 把 Supabase 的 GET 也快取，導致所有裝置永遠讀到第一次快取的舊雲端資料、同步判斷全面失準。`fetch` handler 開頭的 origin 檢查是這條線的護欄，不要移除。

2. **`lastSyncedAt` 只能用伺服器回傳的 `updated_at`，絕不用 `Date.now()`**。裝置時鐘不準會導致該裝置永遠單向覆蓋雲端。`cloudPush()` 用 `Prefer: return=representation` 才拿得到伺服器時間可用。**唯一寫入入口＝`sync.js` 的 `saveServerSyncedAt()`**（2026-08-08 收斂）：伺服器沒回有效時間就「這次不更新」並 warn，不再退回 `Date.now()`（原本 5 個呼叫點各自有 `: Date.now()` fallback，等於留了 5 個破口）。代價只是下次同步多合併一次——逐筆合併冪等，重複 pull 安全；反之寫進錯誤時間是永久性偏差。新增同步路徑一律呼叫這個函式，不要自己組 `saveSyncMeta({ lastSyncedAt })`。

3. **改動 `service-worker.js` 的 `APP_SHELL` 陣列內任一檔案，必同步升 `CACHE_NAME`**。沒做的話瀏覽器偵測不到 SW 本體變化、不裝新版，使用者重新整理/清快取都沒用。

4. **模組層 `let`/`const` 狀態變數必須宣告在 `init()` 呼叫之前**（TDZ）。曾經宣告在檔案更下方，`init()` 內部先執行到用它的函式就丟 `ReferenceError`，被 `init()` 的 try/catch 吞掉，導致 `render()` 整個沒跑、畫面卡在初始 HTML（症狀：標題卡在「行程」二字不變）。

5. **做「容器溢出偵測」的元素要有 `min-width:0` + `overflow:hidden`**，否則 flex 預設不縮小，`scrollWidth===clientWidth` 恆成立，JS 永遠測不到溢出。對應的浮動選單要用 `position:fixed`（JS 算座標），不能用 `absolute`，會被同一層的 `overflow:hidden` 裁掉看不見。

6. **Cloudflare Pages 會把 `/index.html` 重導向到 `/`**，SW 快取到帶 `redirected:true` 的回應會被瀏覽器拒收（PWA 安裝版打開 `ERR_FAILED`）。`sanitizeResponse()` 已處理，`manifest.json` 的 `start_url` 也改用 `./` 而非 `./index.html`，別改回去。

7. **`cloudPull()`/`cloudPush()` 連線失敗要 `throw`，不可回傳 `null`**——`null` 只保留給「HTTP 200 但雲端 0 筆」；否則 `syncNow()` 會把「連線失敗」誤判成「雲端還沒資料」而覆蓋掉正確資料。

8. **大批施工用小包快攻**：一包 1–2 個功能、規格寫死含 grep 定位提示，模型限 Opus/Sonnet/Haiku，超時或卡住的包作廢換模型重派；每包完工先 `node --check` 再 commit。bug 靠猜會來回修不完——**先在 jsdom/沙盒重現再修**（教訓 4 就是這樣抓到的，不是猜出來的）。

9. **UI 版面異動絕不隨意更動**：即使下令「實作」，也要先本機預覽/截圖給使用者確認，才可 push、部署。

10. **`git add` 一律具名檔案**，不用 `git add -A` / `git add .`。

11. **世代快照（`versions/行事曆-NNN/`）一旦建立絕不覆蓋、絕不刪除**——每代都是永久保留的完整核心程式檔複製，供使用者回溯任一代的行為。定義見 `CLAUDE.md`/`AGENTS.md`「存新版」。
12. **開工步驟 0：每次派工/施工前必先自檢工作環境**（橋接連線、資料夾掛載、檔案直讀驗證非過期快取），回報使用者並經使用者確認才動工；異常或卡住超過 2 分鐘一律報故障等裁示，不空燒 token。
13. **區網 http 預覽是「非安全來源」**：`crypto.randomUUID` 等 API 不存在，儲存會炸（已在 init() 加 polyfill 防護）。沙盒重現這類問題必須用非 loopback IP——127.0.0.1 算安全來源，測不出來。預覽一律用 `start-pwa-lan.bat`（no-store 標頭，杜絕手機吃舊 JS 的鬼打牆）。

14. **介面上的「圖示」不要用系統 emoji 呈現跨平台一致的視覺**：同一個 emoji 字元在 Windows/iOS/Android 各吃自己的 emoji 字型，長相（甚至顏色）完全不一樣，且部份字元（如 🌤🌫🌧🌨🌦⛈）預設是「文字呈現」，缺 VS16（`\uFE0F`）在 Windows/Chrome 會整個變單色。需要跨裝置外觀一致的圖示一律自畫 SVG／CSS，不要依賴系統 emoji 字型；真的要用 emoji 純粹點綴時，記得補 VS16 逼它用彩色呈現。

15. **Google 日曆匯入一律唯讀，鎖在「唯一入口」而不是各呼叫點**：`source === 'gcal'` 的行程擋在 `openTaskDialog()`（一擋就連帶擋掉對話框內的刪除）、`handleDragStart()`/`handleDrop()`、`handleCalendarChange()` 三處即可全面生效——`openTaskDialog()` 有十幾個呼叫端，逐點加判斷必漏。OAuth scope 只要 `calendar.readonly` 不要 `auth/calendar`（可寫），讓「不可能改壞使用者的 Google 日曆」是結構保證而非約定。`provider_token` 約 1 小時到期、只存 localStorage 且不進備份 JSON。

16. **所有 `app-0*.js`／`sync.js`／`gcal.js` 共用同一個全域作用域，頂層同名 `function` 會被後定義者靜默覆蓋**——不報錯、不警告，前面那份直接變死碼。`habitStreak()` 就這樣同時存在兩份實作（2026-08-07 已移除死碼版）。新增頂層函式前先 `grep -n "^function 名稱("` 確認名稱沒被用過；懷疑時用這段掃全專案：`python3` 逐檔 regex `^function\s+(\w+)\s*\(` 收集後找重複（最近一次掃描：306 個頂層函式、0 衝突）。

17. **Cloudflare Pages 的 `_redirects` 不支援回 404，但「重定向優先於實體檔案」**——官方文件把「Rewrites (other status codes)」明列為不支援（只有 301/302/303/307/308 與 200 proxy），所以 `/CLAUDE.md / 404` 這種寫法無效；但同一份文件也載明 *"Redirects are always followed, regardless of whether or not an asset matches the incoming request"*，**規則會蓋過同路徑的實體檔案**，因此改用 `302` 導回首頁一樣能讓檔案內容不外洩。本專案輸出目錄是 `/`（Framework=None），等於整包 repo 都被部署，開發文件預設全部可公開讀取，靠根目錄 `_redirects` 擋。踩坑細節：①用 302 不用 301——301 被瀏覽器長期快取，日後要解除很麻煩；②每條規則只能有一個 `*`，副檔名 glob（`/*.sql`）官方未記載、一律逐檔列；③自訂 `404.html` 只對「不存在的路徑」生效，**不能**把已存在的檔案變成 404，不是解法；④真要回 404 得上 Pages Functions middleware，會把純靜態站變成帶 Functions 的部署形態，代價不成比例。**改 `_redirects` 時絕不可把 APP_SHELL 內的檔案列進去，列進去＝正式站直接壞掉。**
