# 背景推播提醒設定教學（CLOUD_PUSH_SETUP.md）

**這是進階選用功能，不設定完全不影響現有一切功能。**「計畫表」預設沒有背景推播，
頁面/App 沒開著時就不會收到通知，跟現在完全一樣；只有照本文件走完全部步驟，
才會多出「App 關閉也能收到行程提醒」這個能力。

## 這是什麼、需要什麼前提

- 目標：手機/電腦把「計畫表」加入主畫面／安裝成 PWA 後，就算把 App 完全關掉，
  行程時間快到時（依「提醒」欄位設定的分鐘數）也能收到系統通知。
- **前提：必須先完成 `CLOUD_SETUP.md` 的雲端同步設定**（有 Supabase 專案、
  Google 登入可用），背景推播是建立在雲端同步之上的功能：靠 Supabase 定期
  掃描每個使用者雲端上的行程資料，找出快到時間的提醒並發送推播。
- 跟「系統推播通知」（README 裡原本就有的功能）不同：那個只有頁面開著、
  瀏覽器在背景執行時才會跳通知；這個就算完全關閉分頁/App 也會收到，
  但要多做這份文件的設定。
- 需要一台**能開終端機/命令提示字元、安裝 Node.js** 的電腦來完成部署
  （手機無法完成安裝步驟，但完成後手機可以直接使用）。

## 步驟一：產生 VAPID 金鑰

VAPID 金鑰是「你的 Supabase 專案」用來對瀏覽器的推播服務證明身份的一組金鑰
（公鑰／私鑰各一把），只需要產生一次。

1. 電腦上需要先安裝 [Node.js](https://nodejs.org/)（LTS 版即可，安裝好後
   命令提示字元輸入 `node -v` 能顯示版本號就代表成功）。
2. 開啟命令提示字元／終端機，輸入：

   ```
   npx web-push generate-vapid-keys
   ```

3. 第一次執行會問要不要安裝 `web-push` 套件，輸入 `y` 或按 Enter 繼續。
4. 執行完會印出類似這樣的兩行（實際內容是一長串英數字）：

   ```
   Public Key:
   BN4Gv...（一長串）

   Private Key:
   xyz123...（一長串）
   ```

5. **把這兩把金鑰都存起來**（例如貼到一個暫時的文字檔），下面步驟會用到：
   - `Public Key` 要填進 `config.js`（步驟二）與 Supabase secrets（步驟五）。
   - `Private Key` 只會填進 Supabase secrets（步驟五），**絕對不要**放進
     `config.js` 或任何前端程式碼——它是私鑰，外流等於任何人都能冒充你的
     專案發送推播。

## 步驟二：公鑰填入 config.js

1. 打開專案資料夾裡的 `config.js`。
2. 找到 `webPushPublicKey: ''`，把空字串換成步驟一拿到的 **Public Key**：

   ```js
   window.CALENDAR_SYNC_CONFIG = {
     supabaseUrl: '...',
     supabaseAnonKey: '...',
     webPushPublicKey: 'BN4Gv...（貼上你的 Public Key）',
   };
   ```

3. 存檔。這一步完成後，用 `start-pwa-local.bat` 或正式網址開啟頁面時，
   「☁️ 雲端同步」對話框（登入後）就會出現「📲 背景推播提醒」的勾選框，
   但目前打勾還不會真的收到通知——後面幾個步驟要先把伺服器端建好。

## 步驟三：Supabase SQL Editor 執行 schema-push.sql

1. 登入你的 Supabase 專案，左側選單開啟 **SQL Editor**。
2. 開一個新查詢，貼上本專案 `schema-push.sql` 的完整內容，按執行（Run）。
3. 這會建立 `push_subscriptions`（存放每台裝置的訂閱資料）與
   `push_sent_log`（防止重複通知）兩張表，並開啟對應的 RLS 規則。

## 步驟四：安裝 Supabase CLI 並部署 Edge Function

Edge Function 是實際負責「定時檢查行程、發送推播」的伺服器端程式，
需要用 Supabase CLI 部署到你的 Supabase 專案。

1. 安裝 Supabase CLI（Windows 建議用 [Scoop](https://scoop.sh/)）：

   ```
   scoop install supabase
   ```

   或參考 Supabase 官方文件的其他安裝方式（例如 npm：
   `npm install -g supabase`，實際能不能用依你電腦環境而定）。

2. 確認安裝成功：

   ```
   supabase --version
   ```

3. 在專案資料夾（`d:\計畫表`，這個資料夾裡要能看到 `supabase\functions\send-reminders\index.ts`）
   開啟命令提示字元，登入 Supabase：

   ```
   supabase login
   ```

   會開啟瀏覽器要求授權，完成後回到命令提示字元即可。

4. 把這個資料夾連結到你的 Supabase 專案（`<project-ref>` 是 Supabase 專案
   網址或 Project Settings 頁面看到的一串英數字代碼，例如
   `uaentjtgdrzbzfkccybs`）：

   ```
   supabase link --project-ref <project-ref>
   ```

   過程可能會要求輸入資料庫密碼（建立專案時設定的那組）。

5. 部署 Edge Function：

   ```
   supabase functions deploy send-reminders
   ```

   部署成功會顯示 Function 的網址，格式類似：
   `https://<project-ref>.supabase.co/functions/v1/send-reminders`。

## 步驟五：設定 secrets（環境變數）

Edge Function 需要 VAPID 金鑰才能發送推播，用 `supabase secrets set` 設定
（這些值只存在 Supabase 伺服器端，不會出現在前端程式碼裡）：

```
supabase secrets set VAPID_PUBLIC_KEY=BN4Gv...（步驟一的 Public Key）
supabase secrets set VAPID_PRIVATE_KEY=xyz123...（步驟一的 Private Key）
supabase secrets set VAPID_SUBJECT=mailto:你的信箱@example.com
```

`VAPID_SUBJECT` 是推播服務規定要附上的聯絡方式（通常是 `mailto:信箱`），
填你自己的信箱即可。

時區預設是 `Asia/Taipei`，不需要另外設定；如果真的需要改，可以：

```
supabase secrets set TZ=Asia/Taipei
```

`SUPABASE_URL` 與 `SUPABASE_SERVICE_ROLE_KEY` 這兩個 Supabase 會自動幫
Edge Function 注入，不用自己設定。

## 步驟六：設定 Cron 定期呼叫

Edge Function 部署好後不會自己執行，需要有人定期呼叫它。最簡單的方式是用
Supabase Dashboard 內建的 Cron 功能。

1. 打開 Supabase 專案 Dashboard，左側選單找 **Integrations**（或直接搜尋
   `Cron`），選擇 **Cron**，按提示啟用（第一次使用需要先啟用 `pg_cron` 與
   `pg_net` 兩個 extension，畫面上通常有一鍵啟用按鈕）。
2. 新增一個 Cron Job，設定：
   - **排程頻率**：每 10 分鐘一次（Cron 表達式 `*/10 * * * *`）。
   - **呼叫方式**：選擇「HTTP Request」，URL 填步驟四部署完顯示的 Function
     網址（`https://<project-ref>.supabase.co/functions/v1/send-reminders`）。
   - **HTTP Method**：`POST`。
   - **Headers**：加一個 `Authorization`，值為
     `Bearer <你的 service_role 金鑰>`（Project Settings → API 頁面的
     **service_role** 金鑰，**不是** anon 金鑰；這把金鑰只會存在 Supabase
     後台設定裡，不會外流到前端）。
3. 如果 Dashboard 介面找不到上述選項，也可以改用 SQL Editor 直接下指令
   （效果相同，進階使用者可選）：

   ```sql
   select cron.schedule(
     'send-reminders-every-10-min',
     '*/10 * * * *',
     $$
     select net.http_post(
       url := 'https://<project-ref>.supabase.co/functions/v1/send-reminders',
       headers := jsonb_build_object(
         'Authorization', 'Bearer <你的 service_role 金鑰>',
         'Content-Type', 'application/json'
       )
     );
     $$
   );
   ```

### 用 curl 手動測試（選用，確認 Function 本身正常運作）

在命令提示字元執行（把 `<project-ref>` 與 `<service_role 金鑰>` 換成你的）：

```
curl -X POST "https://<project-ref>.supabase.co/functions/v1/send-reminders" ^
  -H "Authorization: Bearer <service_role 金鑰>" ^
  -H "Content-Type: application/json"
```

正常會回傳類似 `{"ok":true,"todayKey":"2026-07-16","sent":0,"skipped":0,"failed":0}`
的 JSON（`sent` 是這次實際發出的推播數，測試當下如果沒有任何行程符合條件是
`0` 屬於正常）。如果回傳 `ok:false` 或 HTTP 500，訊息裡通常會直接寫出缺了
哪個環境變數，回頭檢查步驟五。

## 步驟七：手機實測

1. 手機瀏覽器開啟「計畫表」網址（正式網址或區網 `start-pwa-local.bat`），
   依 README「PWA 安裝與離線使用」加入主畫面。iPhone（Safari）需要
   **16.4 以上版本**，且**必須先加入主畫面**才支援背景推播，直接在 Safari
   分頁裡打勾不會生效。
2. 打開主畫面圖示（不是瀏覽器分頁），登入雲端同步。
3. 點工具列「☁️ 雲端同步」，登入區會看到「📲 背景推播提醒」勾選框，打勾。
4. 瀏覽器會跳出「是否允許通知」的系統詢問，選「允許」。
5. 狀態文字變成「背景推播提醒已開啟」代表訂閱成功。
6. 新增一筆「提醒時間」設定為快到期（例如現在時間 5 分鐘後開始、提醒選
   「5 分鐘前」）的行程，等 Cron 排程執行一輪（最多等 10 分鐘）；也可以用
   上面「curl 手動測試」的指令立即觸發一次，不用乾等排程。
7. 把 App 整個關掉（滑掉背景程式），確認手機仍然跳出系統通知、點通知會開啟
   「計畫表」。

## 關掉背景推播

- 使用者端：到「☁️ 雲端同步」對話框把「📲 背景推播提醒」取消勾選即可，
  會自動取消瀏覽器訂閱並刪除雲端的訂閱紀錄。
- 整個功能停用：把 `config.js` 的 `webPushPublicKey` 改回空字串並存檔，
  App 就會完全不出現這個功能的任何 UI，回到加入這個功能之前的狀態
  （已經訂閱過的裝置，訂閱紀錄仍會留在 `push_subscriptions` 表，但因為
  Edge Function 邏輯本身還在，若擔心持續發送可另外到 Supabase Dashboard
  停用或刪除 Cron Job）。

## 常見問題

- **打勾後沒有跳出通知權限詢問**：檢查瀏覽器是否已經被使用者手動封鎖過
  這個網站的通知權限（網址列旁的鎖頭圖示可以查看/重設）。
- **勾選框顯示「此瀏覽器不支援背景推播」**：多半是 `file://` 直接雙擊
  `index.html` 開啟（背景推播需要透過 `start-pwa-local.bat` 或正式網址），
  或瀏覽器版本太舊、或 iPhone 還沒加入主畫面。
- **勾選框顯示「請先登入雲端同步」**：先完成 `CLOUD_SETUP.md` 的 Google
  登入，背景推播依附在雲端同步的登入狀態上。
- **手機沒收到通知，但 curl 測試回傳 `sent` 有數字**：確認手機的系統設定
  裡「計畫表」（或瀏覽器）沒有被關閉通知權限，以及 PWA 是否真的是從主畫面
  圖示開啟並完成訂閱（不是瀏覽器分頁）。
- **`supabase functions deploy` 失敗**：確認 `supabase login`／
  `supabase link` 都成功過，以及網路連線正常；錯誤訊息通常會直接指出
  問題（例如專案代碼打錯）。
- **想暫停但不想整個關掉功能**：到 Supabase Dashboard 的 Cron 頁面把
  排程 Job 停用/刪除即可，Edge Function 與資料表都不用動，之後要恢復
  再重新啟用排程即可。
