# 雲端同步設定教學（CLOUD_SETUP.md）

「計畫表」預設是**純本機**：資料只存在瀏覽器 `localStorage`，不需要帳號、不需要伺服器。

這份文件教你「選擇性」啟用雲端同步：登入 Google 帳號後，可以把行程備份同步到你自己的
Supabase 專案，讓多台裝置（例如公司電腦與家裡電腦）共用同一份資料。

**沒做這份設定之前，App 完全不受影響，也不會有任何網路連線。**

## 這是什麼樣的同步

- **個人跨裝置同步**，不是多人即時協作。同一個 Google 帳號在不同裝置上使用，
  行程會同步；不同帳號之間互相看不到彼此資料。
- **Last-write-wins（後寫入者覆蓋）**：同步時會比較雲端與本機的更新時間，
  較新的一份會整包覆蓋另一份。如果你在兩台裝置都「離線」編輯過同一段時間的行程，
  才各自連網同步，較晚同步的裝置會覆蓋較早同步的裝置，不會自動合併兩邊的變更。
  建議：換裝置使用前，先在原本的裝置按一次「立即同步」。
- 同步的是**整包備份 JSON**（等同工具列「備份」按鈕匯出的內容），不是一筆一筆行程分開存。

## 步驟一：建立 Supabase 專案

1. 到 https://supabase.com 註冊／登入，建立一個新專案（免費方案即可）。
2. 等專案建立完成（第一次啟動大約 1–2 分鐘）。

## 步驟二：建立資料表

1. 在 Supabase 專案左側選單開啟 **SQL Editor**。
2. 開一個新查詢，貼上本專案 `schema.sql` 的完整內容，按執行（Run）。
3. 這會建立 `sync_state` 表，並開啟 RLS（Row Level Security），
   確保每個使用者只能讀寫自己那一列資料。

## 步驟三：開啟 Google 登入

1. 左側選單 **Authentication → Providers**，找到 **Google**，切換為啟用。
2. 依畫面指示到 Google Cloud Console 建立 OAuth 用戶端 ID／密鑰
   （Google 那邊需要設定「授權的重新導向 URI」，填入 Supabase 頁面上顯示的
   `https://<你的專案>.supabase.co/auth/v1/callback`）。
3. 把 Google 給的 Client ID／Client Secret 貼回 Supabase 的 Google provider 設定並儲存。

## 步驟四：設定 Redirect URL

1. 左側選單 **Authentication → URL Configuration**。
2. 在 **Site URL** 或 **Redirect URLs** 加入你實際打開「計畫表」的網址，例如：
   - 用 `start-pwa-local.bat` 啟動本機伺服器時：`http://127.0.0.1:8765/index.html`
     （或你電腦的區域網路 IP，例如 `http://192.168.1.10:8765/index.html`）
   - 之後也可以是你部署上去的正式網址（如果之後有架站）。
3. **注意**：直接雙擊 `index.html` 開啟的 `file://` 網址無法完成 Google 登入導回流程，
   雲端同步登入時請透過 `start-pwa-local.bat` 啟動的本機網址開啟頁面
   （這與 App 本身「不需要伺服器」不衝突：不開啟同步功能時仍可雙擊 `index.html` 正常使用）。

## 步驟五：填入 config.js

1. 左側選單 **Project Settings → API**。
2. 複製 **Project URL**，貼到 `config.js` 的 `supabaseUrl`。
3. 複製 **anon public** 金鑰，貼到 `config.js` 的 `supabaseAnonKey`。
4. 存檔，重新整理頁面。此時工具列會出現「☁️ 雲端同步」按鈕（原本會顯示「未設定」）。

`config.example.js` 只是範例／備份，實際生效的是 `config.js`。

## 步驟六：登入與同步

1. 點工具列「☁️ 雲端同步」，按「使用 Google 登入」。
2. 登入完成會導回頁面，自動同步一次，並在對話框看到你的登入 email。
3. 「立即同步」：手動同步一次。
4. 「自動同步」勾選後，之後每次存檔（新增/編輯/完成勾選等）會在你停止操作幾秒後
   自動同步到雲端；這個開關本身也會存在本機設定裡（跟著備份一起匯出/還原）。
5. 「登出」只會清除本機登入狀態，不會刪除任何行程資料。

## 關於安全性

- `config.js` 裡的 **anon public 金鑰**依 Supabase 的設計本來就可以公開內嵌在前端程式碼中，
  它不是密鑰。真正保護資料的是 `schema.sql` 建立的 **RLS（Row Level Security）** 規則：
  資料庫只允許 `auth.uid() = user_id` 的人讀寫自己那一列，其他人即使拿到 anon key
  也讀不到別人的資料。
- 絕對不要把 Supabase 的 `service_role` 金鑰放進這個純前端專案（那把金鑰會繞過 RLS）。
- 登入用的 access token／refresh token 只存在瀏覽器 localStorage
  （key 為 `desktop-schedule-sync-auth-v1`），**不會**被包進「備份」匯出的 JSON 檔，
  所以你可以放心把備份 JSON 檔分享或存放，不會外洩帳號登入憑證。

## 停用雲端同步

把 `config.js` 的 `supabaseUrl` / `supabaseAnonKey` 改回空字串並存檔即可完全停用，
App 會回到純本機模式；本機資料不會被刪除。

## 常見問題

- **點「使用 Google 登入」沒反應或登入後跳回未登入**：通常是 Redirect URL 沒設定對，
  回到步驟四確認網址完全一致（含 port）。
- **同步失敗，畫面顯示「雲端同步失敗」**：檢查網路連線、`config.js` 是否填對，
  以及 Supabase 專案是否還在（免費方案閒置一段時間可能會暫停，到後台喚醒即可）。
  同步失敗時本機資料一律不受影響。
- **想清掉雲端上的資料重新開始**：到 Supabase **Table Editor → sync_state**，
  刪掉自己 `user_id` 那一列即可，下次同步會用本機資料重新上傳。
