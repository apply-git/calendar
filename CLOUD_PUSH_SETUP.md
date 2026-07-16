# 背景推播提醒設定教學（CLOUD_PUSH_SETUP.md）

**這是進階選用功能，不設定完全不影響現有一切功能。**「計畫表」預設沒有背景推播，
頁面/App 沒開著時就不會收到通知，跟現在完全一樣；只有照本文件走完全部步驟，
才會多出「App 關閉也能收到行程提醒」這個能力。

**這份文件全程只需要滑鼠點擊 + 複製貼上，不需要安裝任何軟體、不需要打指令、
不需要開終端機/命令提示字元。** 全部操作都在瀏覽器裡的 Supabase 網站後台完成。

## 這是什麼、需要什麼前提

- 目標：手機/電腦把「計畫表」加入主畫面／安裝成 PWA 後，就算把 App 完全關掉，
  行程時間快到時（依「提醒」欄位設定的分鐘數）也能收到系統通知。
- **前提：必須先完成 `CLOUD_SETUP.md` 的雲端同步設定**（有 Supabase 專案、
  Google 登入可用），背景推播是建立在雲端同步之上的功能：靠 Supabase 定期
  掃描每個使用者雲端上的行程資料，找出快到時間的提醒並發送推播。
- 跟「系統推播通知」（README 裡原本就有的功能）不同：那個只有頁面開著、
  瀏覽器在背景執行時才會跳通知；這個就算完全關閉分頁/App 也會收到，
  但要多做這份文件的設定。

## 步驟一：VAPID 金鑰

VAPID 金鑰是「你的 Supabase 專案」用來對瀏覽器的推播服務證明身份的一組金鑰
（公鑰／私鑰各一把），整個專案只需要一組，只要產生一次、之後都重複使用。

**這組金鑰通常由總指揮（幫你設定這個功能的人）直接提供給你**，如果你已經拿到
一組「Public Key」「Private Key」，可以直接跳到步驟二，不用自己產生。

如果沒有人幫你準備、需要自己從頭產生，才需要用到電腦上的命令提示字元（這是本
文件唯一可能用到指令的地方，其餘步驟都不需要）：

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

**這一步通常由總指揮直接幫你把金鑰填好**，如果已經是填好的狀態可以跳過確認即可。

自己動手的話：

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

## 步驟三：SQL Editor 執行 schema-push.sql

1. 瀏覽器開啟：<https://supabase.com/dashboard/project/uaentjtgdrzbzfkccybs/sql/new>
   （或自己登入 Supabase 後，左側選單點 **SQL Editor** → **New query**）。
2. 把下面這一整塊 SQL 全部複製，貼到編輯器裡，按右下角（或 Ctrl+Enter）**Run** 執行。

   ```sql
   -- ============================================================================
   -- schema-push.sql — 「計畫表」背景推播提醒用資料表（進階選用功能）
   -- ----------------------------------------------------------------------------
   -- 在 Supabase 專案的 SQL Editor 貼上整份檔案並執行一次即可（選用功能，
   -- 不執行也不影響既有的 schema.sql / sync_state 同步功能與 schema-history.sql）。
   --
   -- 用途：
   --   - public.push_subscriptions：存放每台裝置訂閱背景推播時瀏覽器給的
   --     PushSubscription（含 endpoint 與加密金鑰），供 Edge Function
   --     send-reminders 讀取後對該使用者名下所有訂閱裝置發送推播。
   --   - public.push_sent_log：發送紀錄，避免同一筆行程同一天被重複通知
   --     （Edge Function 由排程每隔幾分鐘呼叫一次，需要有防重複機制）。
   --
   -- 完整部署與設定步驟見 CLOUD_PUSH_SETUP.md。
   -- ============================================================================

   -- ----------------------------------------------------------------------------
   -- push_subscriptions：每一筆代表「某使用者的某一台裝置／瀏覽器」訂閱了推播
   -- ----------------------------------------------------------------------------
   create table if not exists public.push_subscriptions (
     endpoint     text primary key,
     user_id      uuid not null references auth.users (id) on delete cascade,
     subscription jsonb not null,
     created_at   timestamptz not null default now()
   );

   comment on table public.push_subscriptions is '背景推播訂閱清單：一列代表一台裝置/瀏覽器的一份 PushSubscription，endpoint 當主鍵天然去重（同一裝置重複訂閱會覆蓋舊資料）。';
   comment on column public.push_subscriptions.endpoint is '瀏覽器推播服務（FCM/Mozilla Push 等）配發的訂閱端點網址，同時作為主鍵；前端用 on_conflict=endpoint 做 upsert。';
   comment on column public.push_subscriptions.user_id is '這份訂閱屬於哪個使用者（Supabase Auth 的 auth.users.id），Edge Function 依此篩選出要通知的訂閱。';
   comment on column public.push_subscriptions.subscription is '整包 PushSubscription.toJSON() 的內容（含 endpoint、expirationTime、keys.p256dh、keys.auth），Edge Function 發送推播時直接整包丟給加密函式使用。';

   -- 依 user_id 建索引：Edge Function 每次要找「某使用者名下所有訂閱裝置」都會用到。
   create index if not exists push_subscriptions_user_id_idx
     on public.push_subscriptions (user_id);

   -- 開啟 RLS：預設拒絕所有存取，只靠下面的 policy 開放。
   alter table public.push_subscriptions enable row level security;

   -- 只有本人（auth.uid() 等於該列 user_id）能讀到自己的訂閱清單。
   drop policy if exists "push_subscriptions_select_own" on public.push_subscriptions;
   create policy "push_subscriptions_select_own"
     on public.push_subscriptions
     for select
     using (auth.uid() = user_id);

   -- 只有本人能新增「自己 user_id」的訂閱（前端 push.js 訂閱成功後會 upsert 一筆）。
   drop policy if exists "push_subscriptions_insert_own" on public.push_subscriptions;
   create policy "push_subscriptions_insert_own"
     on public.push_subscriptions
     for insert
     with check (auth.uid() = user_id);

   -- 只有本人能更新自己的訂閱（upsert 走 on_conflict=endpoint 時，同一 endpoint 已存在的情況會走到 update）。
   drop policy if exists "push_subscriptions_update_own" on public.push_subscriptions;
   create policy "push_subscriptions_update_own"
     on public.push_subscriptions
     for update
     using (auth.uid() = user_id)
     with check (auth.uid() = user_id);

   -- 只有本人能刪除自己的訂閱（使用者在「☁️ 雲端同步」對話框關閉背景推播時會用到）。
   drop policy if exists "push_subscriptions_delete_own" on public.push_subscriptions;
   create policy "push_subscriptions_delete_own"
     on public.push_subscriptions
     for delete
     using (auth.uid() = user_id);

   -- ----------------------------------------------------------------------------
   -- push_sent_log：Edge Function 的「防重複通知」紀錄表
   -- ----------------------------------------------------------------------------
   -- 排程每隔幾分鐘就會呼叫一次 send-reminders，同一筆行程的提醒時間窗可能被
   -- 掃到不只一次；靠 (user_id, task_id, fire_date) 當複合主鍵，發送前先嘗試
   -- insert 一筆，insert 成功才代表「今天這筆行程還沒發送過」、可以繼續發送，
   -- insert 因主鍵衝突失敗就代表今天已經發過，直接跳過。
   --
   -- 這張表完全不開放任何 policy：RLS 開啟但沒有任何 select/insert/update/delete
   -- policy，代表 anon / authenticated 角色一律無法存取；只有 Edge Function 用的
   -- service_role（在 Postgres 有 BYPASSRLS 屬性）能讀寫，前端／一般使用者接觸不到。
   create table if not exists public.push_sent_log (
     user_id   uuid not null references auth.users (id) on delete cascade,
     task_id   text not null,
     fire_date date not null,
     sent_at   timestamptz not null default now(),
     primary key (user_id, task_id, fire_date)
   );

   comment on table public.push_sent_log is '背景推播「今天這筆行程是否已經發送過」的防重複紀錄，只有 service_role（Edge Function）能讀寫，前端完全碰不到，RLS 開啟但刻意不建任何 policy。';
   comment on column public.push_sent_log.task_id is '對應 app.js 行程物件的 id（task.id，字串），不是資料庫自建的序號。';
   comment on column public.push_sent_log.fire_date is '這筆提醒對應的行事曆日期（YYYY-MM-DD，依 Edge Function 設定的 TZ 時區計算），跟 task_id 一起去重，重複行程每天各算一筆。';

   alter table public.push_sent_log enable row level security;
   -- 刻意不建立任何 policy：RLS 預設「拒絕所有人」，只有 service_role 能繞過 RLS 讀寫這張表。
   ```

3. 執行成功後左下角會顯示「Success」。這會建立 `push_subscriptions`（存放每台裝置的
   訂閱資料）與 `push_sent_log`（防止重複通知）兩張表，並開啟對應的 RLS 規則。
   （如果看到「already exists」之類的訊息也沒關係，代表這張表之前已經建立過。）

## 步驟四：Dashboard 建立 Edge Function（不需要安裝任何東西）

Edge Function 是實際負責「定時檢查行程、發送推播」的伺服器端程式。Supabase 現在
支援直接在網頁後台的編輯器裡貼上程式碼並部署，**不需要安裝 Supabase CLI、不需要
Node.js、不需要開終端機**（官方文件：<https://supabase.com/docs/guides/functions/quickstart-dashboard>）。

1. 瀏覽器開啟：<https://supabase.com/dashboard/project/uaentjtgdrzbzfkccybs/functions>
   （或登入 Supabase 後，左側選單點 **Edge Functions**）。
2. 點畫面上的 **Deploy a new function** 按鈕，選 **Via Editor**（透過編輯器）。
3. 會看到幾個範本可以選（Hello World、Stripe Webhook…），**隨便選一個都可以**
   （例如「Hello World」），因為等一下會把裡面的程式碼整個換掉。
4. 進到編輯器畫面後：
   - **先確認/修改函式名稱為 `send-reminders`**（畫面上通常在編輯器上方或建立時
     可以看到、可以點擊修改的函式名稱欄位；這個名稱之後會變成網址的一部分
     `.../functions/v1/send-reminders`，**一定要跟這個名稱一致**，後面設定 Cron
     才呼叫得到）。
   - 把編輯器裡預設的範本程式碼**全部刪除**，改貼上本專案
     `supabase/functions/send-reminders/index.ts` 這個檔案的**全部內容**
     （用文字編輯器打開這個檔案，Ctrl+A 全選、Ctrl+C 複製，回到瀏覽器編輯器
     Ctrl+A 全選、貼上覆蓋）。
5. 按 **Deploy function**（或 Deploy updates，如果是編輯既有函式）。等待約
   10~30 秒，出現成功訊息即代表部署完成。
6. 部署成功後，函式網址會是：
   `https://uaentjtgdrzbzfkccybs.supabase.co/functions/v1/send-reminders`
   （下面步驟六設定 Cron 會用到這個網址，已經幫你填在後面的 SQL 裡了）。

> 這個 Dashboard 內建編輯器官方註明**目前沒有版本控制/回復舊版功能**，只適合這種
> 「貼一支獨立函式、之後很少改」的用途；如果之後真的需要改 `index.ts`，
> 回到這個函式的頁面直接編輯、重新 Deploy updates 即可覆蓋更新。

## 步驟五：Dashboard 設定 secrets（環境變數）

Edge Function 需要 VAPID 金鑰才能發送推播，直接在網頁後台填入即可（這些值只存在
Supabase 伺服器端，不會出現在前端程式碼裡）：

1. 瀏覽器開啟：<https://supabase.com/dashboard/project/uaentjtgdrzbzfkccybs/functions/secrets>
   （或登入 Supabase 後，左側選單 **Edge Functions** → 找 **Secrets** 分頁/連結；
   這個頁面是整個專案共用的，不是單一函式底下的設定）。
2. 依序新增三筆 Key / Value（填好按 **Save**，可以一次貼多筆）：

   | Key | Value |
   | --- | --- |
   | `VAPID_PUBLIC_KEY` | 步驟一拿到的 Public Key（跟 `config.js` 的 `webPushPublicKey` 同一把） |
   | `VAPID_PRIVATE_KEY` | 步驟一拿到的 Private Key（**絕對不要**填進 `config.js` 或任何前端檔案） |
   | `VAPID_SUBJECT` | `mailto:cthouse.lee@gmail.com`（換成你自己的信箱，這是推播服務規定要附上的聯絡方式） |

3. 不需要另外設定 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`——這兩個 Supabase
   會自動幫 Edge Function 注入。
4. 時區預設是 `Asia/Taipei`，不需要另外設定；如果真的需要改，可以在同一個頁面
   新增一筆 `TZ` = `Asia/Taipei`（或其他時區名稱）。
5. **設定完不需要重新部署**，Edge Function 下次被呼叫時就會讀到新的 secrets。

## 步驟六：設定 Cron 每 10 分鐘自動呼叫

Edge Function 部署好後不會自己執行，需要定期有人呼叫它。用 Supabase 內建的
`pg_cron` + `pg_net`（Postgres 排程 + 對外發 HTTP 請求的官方擴充功能）設定，一樣全程
在 SQL Editor 貼上執行即可，**下面 SQL 已經幫你填好正確的 Function 網址**。

1. 瀏覽器開啟：<https://supabase.com/dashboard/project/uaentjtgdrzbzfkccybs/settings/api>
   （或登入 Supabase 後，左側選單 **Project Settings → API**），找到
   **service_role**（有時顯示為 **secret** key）那一串金鑰，點旁邊的複製圖示複製起來。
   **注意：這是 `service_role`／`secret` 金鑰，不是 `anon`／`publishable` 金鑰**，
   這把金鑰擁有完整資料庫存取權限，只會貼進下面的 Cron 設定（存在 Supabase 後台
   資料庫裡），不會外流到前端程式碼。
2. 回到 SQL Editor（<https://supabase.com/dashboard/project/uaentjtgdrzbzfkccybs/sql/new>），
   新開一個查詢，貼上下面整段 SQL，把其中的
   `<貼上你複製的 service_role 金鑰>` 換成剛剛複製的那一串，再執行（Run）：

   ```sql
   -- 1) 啟用兩個必要的擴充功能（已經啟用過的話重複執行也不會出錯）
   create extension if not exists pg_cron;
   create extension if not exists pg_net;

   -- 2) 建立每 10 分鐘呼叫一次 send-reminders 的排程
   --    網址已經是這個專案（uaentjtgdrzbzfkccybs）的正式 Function 網址，不用再改。
   select cron.schedule(
     'send-reminders-every-10-min',
     '*/10 * * * *',
     $$
     select net.http_post(
       url := 'https://uaentjtgdrzbzfkccybs.supabase.co/functions/v1/send-reminders',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer <貼上你複製的 service_role 金鑰>'
       ),
       timeout_milliseconds := 20000
     ) as request_id;
     $$
   );
   ```

3. 執行成功會回傳一個數字（新建立的排程 job id），代表排程已經生效，之後每 10
   分鐘會自動呼叫一次 `send-reminders`。

### 如果想用滑鼠點擊的圖形介面設定（不寫 SQL）

Supabase Dashboard 也有純點擊版的 Cron 介面，效果跟上面的 SQL 完全一樣，兩種擇一
即可（不用兩個都做）：

1. 瀏覽器開啟：<https://supabase.com/dashboard/project/uaentjtgdrzbzfkccybs/integrations/cron/jobs>
   （或登入 Supabase 後，左側選單找 **Integrations** → **Cron**；第一次使用可能會
   提示要啟用 `pg_cron`/`pg_net`，畫面上通常有一鍵啟用按鈕，按下去即可）。
2. 點 **Create job**。
3. 幫排程取個名字（例如 `send-reminders-every-10-min`）。
4. 排程時間選「每 10 分鐘」，或直接輸入 Cron 表達式 `*/10 * * * *`。
5. 類型（Type）選 **Supabase Edge Function**（如果畫面上有這個選項，選了之後通常
   會直接讓你從清單選 `send-reminders`，網址跟授權會自動帶好）；如果畫面上沒有這個
   類型、只看到 **HTTP Request**，改選它並手動填：
   - **URL**：`https://uaentjtgdrzbzfkccybs.supabase.co/functions/v1/send-reminders`
   - **HTTP Method**：`POST`
   - **Headers**：新增一筆 `Authorization`，值為 `Bearer <上面複製的 service_role 金鑰>`，
     再新增一筆 `Content-Type` 值為 `application/json`。
6. 儲存即可。

### 用瀏覽器網址列手動測試（選用，確認 Function 本身正常運作）

Edge Function 部署完、secrets 也設定好之後，可以先不等 Cron，直接測試一次：回到
函式頁面（<https://supabase.com/dashboard/project/uaentjtgdrzbzfkccybs/functions>
→ 點 `send-reminders`），畫面上通常有 **Test** 按鈕可以直接送出一次測試請求，
或是看 **Logs** 分頁確認 Cron 排程每次實際呼叫的結果（見步驟七「常見問題」）。

正常回應會類似：

```json
{"ok":true,"todayKey":"2026-07-16","sent":0,"skipped":0,"failed":0}
```

（`sent` 是這次實際發出的推播數，測試當下如果沒有任何行程符合條件是 `0` 屬於
正常。）如果回傳 `ok:false`，訊息裡通常會直接寫出缺了哪個環境變數，回頭檢查步驟五。

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
   上面「用瀏覽器網址列手動測試」的方式立即觸發一次，不用乾等排程。
7. 把 App 整個關掉（滑掉背景程式），確認手機仍然跳出系統通知、點通知會開啟
   「計畫表」。

## 關掉背景推播

- 使用者端：到「☁️ 雲端同步」對話框把「📲 背景推播提醒」取消勾選即可，
  會自動取消瀏覽器訂閱並刪除雲端的訂閱紀錄。
- 整個功能停用：把 `config.js` 的 `webPushPublicKey` 改回空字串並存檔，
  App 就會完全不出現這個功能的任何 UI，回到加入這個功能之前的狀態
  （已經訂閱過的裝置，訂閱紀錄仍會留在 `push_subscriptions` 表，但因為
  Edge Function 邏輯本身還在，若擔心持續發送可另外到 Supabase Dashboard
  停用或刪除 Cron Job，見下方「想暫停但不想整個關掉功能」）。

## 常見問題

- **打勾後沒有跳出通知權限詢問**：檢查瀏覽器是否已經被使用者手動封鎖過
  這個網站的通知權限（網址列旁的鎖頭圖示可以查看/重設）。
- **勾選框顯示「此瀏覽器不支援背景推播」**：多半是 `file://` 直接雙擊
  `index.html` 開啟（背景推播需要透過 `start-pwa-local.bat` 或正式網址），
  或瀏覽器版本太舊、或 iPhone 還沒加入主畫面。
- **勾選框顯示「請先登入雲端同步」**：先完成 `CLOUD_SETUP.md` 的 Google
  登入，背景推播依附在雲端同步的登入狀態上。
- **手機沒收到通知，但手動測試回傳 `sent` 有數字**：確認手機的系統設定
  裡「計畫表」（或瀏覽器）沒有被關閉通知權限，以及 PWA 是否真的是從主畫面
  圖示開啟並完成訂閱（不是瀏覽器分頁）。
- **不確定 Cron 有沒有照時間執行、或想看每次執行的結果**：Dashboard 的
  Edge Function 頁面（`Edge Functions` → 點 `send-reminders`）有 **Logs**
  分頁，可以看到每一次被呼叫的時間、回應內容、以及程式內 `console.error`
  印出的錯誤訊息；Cron 那邊（`Integrations → Cron` → 點排程名稱 →
  **History**）可以看到排程本身是否按時觸發、每次呼叫的 HTTP 狀態碼。
  兩邊搭配看最容易抓到問題出在「排程沒觸發」還是「Function 執行失敗」。
- **Dashboard 編輯器貼上程式碼後出現紅色底線/錯誤提示**：如果是在
  `import` 那幾行下面出現提示，通常只是編輯器的型別檢查在提醒「這是網路
  上的模組，本地沒有安裝」，不影響部署與執行，直接按 **Deploy function**
  即可；如果是部署當下噴出的錯誤（不是編輯器裡的提示），訊息裡通常會直接
  指出問題（例如漏貼到某一段程式碼），回頭比對 `index.ts` 檔案內容是否
  整段都貼進去了。
- **想暫停但不想整個關掉功能**：到 Supabase Dashboard 的 Cron 頁面
  （`Integrations → Cron`）把排程 Job 停用/刪除即可（或在 SQL Editor 執行
  `select cron.unschedule('send-reminders-every-10-min');`），Edge Function
  與資料表都不用動，之後要恢復再重新啟用/重新排程即可。
