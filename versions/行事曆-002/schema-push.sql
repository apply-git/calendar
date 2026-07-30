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
comment on column public.push_subscriptions.subscription is '整包 PushSubscription.toJSON() 的內容（含 endpoint、expirationTime、keys.p256dh、keys.auth），Edge Function 發送推播時直接整包丟給 web-push 函式庫使用。';

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
