# Notes — 踩坑鐵則

1. **Service Worker 只准快取同網域靜態檔，絕不可快取跨網域 API**。曾經 cache-first 把 Supabase 的 GET 也快取，導致所有裝置永遠讀到第一次快取的舊雲端資料、同步判斷全面失準。`fetch` handler 開頭的 origin 檢查是這條線的護欄，不要移除。

2. **`lastSyncedAt` 只能用伺服器回傳的 `updated_at`，絕不用 `Date.now()`**。裝置時鐘不準會導致該裝置永遠單向覆蓋雲端。`cloudPush()` 用 `Prefer: return=representation` 才拿得到伺服器時間可用。

3. **改動 `service-worker.js` 的 `APP_SHELL` 陣列內任一檔案，必同步升 `CACHE_NAME`**。沒做的話瀏覽器偵測不到 SW 本體變化、不裝新版，使用者重新整理/清快取都沒用。

4. **模組層 `let`/`const` 狀態變數必須宣告在 `init()` 呼叫之前**（TDZ）。曾經宣告在檔案更下方，`init()` 內部先執行到用它的函式就丟 `ReferenceError`，被 `init()` 的 try/catch 吞掉，導致 `render()` 整個沒跑、畫面卡在初始 HTML（症狀：標題卡在「行程」二字不變）。

5. **做「容器溢出偵測」的元素要有 `min-width:0` + `overflow:hidden`**，否則 flex 預設不縮小，`scrollWidth===clientWidth` 恆成立，JS 永遠測不到溢出。對應的浮動選單要用 `position:fixed`（JS 算座標），不能用 `absolute`，會被同一層的 `overflow:hidden` 裁掉看不見。

6. **Cloudflare Pages 會把 `/index.html` 重導向到 `/`**，SW 快取到帶 `redirected:true` 的回應會被瀏覽器拒收（PWA 安裝版打開 `ERR_FAILED`）。`sanitizeResponse()` 已處理，`manifest.json` 的 `start_url` 也改用 `./` 而非 `./index.html`，別改回去。

7. **`cloudPull()`/`cloudPush()` 連線失敗要 `throw`，不可回傳 `null`**——`null` 只保留給「HTTP 200 但雲端 0 筆」；否則 `syncNow()` 會把「連線失敗」誤判成「雲端還沒資料」而覆蓋掉正確資料。

8. **大批施工用小包快攻**：一包 1–2 個功能、規格寫死含 grep 定位提示，模型限 Opus/Sonnet/Haiku，超時或卡住的包作廢換模型重派；每包完工先 `node --check` 再 commit。bug 靠猜會來回修不完——**先在 jsdom/沙盒重現再修**（教訓 4 就是這樣抓到的，不是猜出來的）。

9. **UI 版面異動絕不隨意更動**：即使下令「實作」，也要先本機預覽/截圖給使用者確認，才可 push、部署。

10. **`git add` 一律具名檔案**，不用 `git add -A` / `git add .`。
