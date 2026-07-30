-- ============================================================================
-- schema-errorlog.sql — 「計畫表」錯誤紀錄自動上報用資料表（進階選用功能）
-- ----------------------------------------------------------------------------
-- 在 Supabase 專案的 SQL Editor 貼上整份檔案並執行一次即可（選用功能，
-- 不執行也不影響既有的 schema.sql / sync_state 同步功能與其他既有功能）。
--
-- 用途：
--   - public.error_reports：把使用者裝置上（app-09-entry.js 的本機環形
--     緩衝 errorLog）收集到的錯誤紀錄，選擇性地自動送一份到雲端，方便
--     開發者遠端診斷手機端才會出現、開發者自己重現不了的問題。
--
-- 隱私聲明：這張表只存錯誤訊息、呼叫堆疊前段、瀏覽器 UA、頁面路徑
-- （不含 query string），【絕不】包含 localStorage 內容、登入 token、
-- 或任何行程資料本身；前端此功能預設關閉，使用者需自行在設定中開啟。
-- ============================================================================

-- ----------------------------------------------------------------------------
-- error_reports：每一列代表一筆使用者裝置端主動上報的錯誤紀錄
-- ----------------------------------------------------------------------------
create table if not exists public.error_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  occurred_at timestamptz,
  message text not null,
  stack text,
  page_url text,
  user_agent text
);

comment on table public.error_reports is '使用者裝置端自動上報的錯誤診斷紀錄，前端預設關閉、需登入且手動開啟後才會送；只含訊息/堆疊/UA/頁面路徑，不含行程資料或 token。';
comment on column public.error_reports.id is '這筆上報紀錄的伺服器端主鍵，跟前端本機環形緩衝的順序無關。';
comment on column public.error_reports.user_id is '上報者的 Supabase Auth 使用者 id（auth.users.id），未登入時前端不會送出這張表的資料。';
comment on column public.error_reports.created_at is '這筆紀錄送達伺服器的時間（伺服器時鐘），用於排序與清理。';
comment on column public.error_reports.occurred_at is '錯誤在使用者裝置上實際發生的時間（對應前端 recordError() 記下的 entry.time），可能早於 created_at。';
comment on column public.error_reports.message is '錯誤訊息文字（前端已截斷至 2000 字），例如 window.onerror 或 unhandledrejection 帶出的訊息。';
comment on column public.error_reports.stack is '呼叫堆疊前 500 字（前端已截斷），可能為空；僅供定位錯誤發生位置，不含任何使用者資料內容。';
comment on column public.error_reports.page_url is '錯誤發生當下的頁面網址，只留 origin + pathname，不含 query string（避免夾帶參數化的私人資訊）。';
comment on column public.error_reports.user_agent is '瀏覽器 User-Agent 字串，用於判斷是哪個裝置/瀏覽器/版本觸發的錯誤。';

-- 依 user_id + created_at 建索引：查「某使用者最近的上報紀錄」會用到。
create index if not exists error_reports_user_created_idx
  on public.error_reports (user_id, created_at desc);

-- 開啟 RLS：預設拒絕所有存取，只靠下面的 policy 開放。
alter table public.error_reports enable row level security;

-- 只有本人能新增「自己 user_id」的上報紀錄（前端 reportErrorToCloud() 送出時用）。
drop policy if exists "error_reports_insert_own" on public.error_reports;
create policy "error_reports_insert_own"
  on public.error_reports
  for insert
  with check (auth.uid() = user_id);

-- 只有本人能讀到自己上報過的紀錄。
drop policy if exists "error_reports_select_own" on public.error_reports;
create policy "error_reports_select_own"
  on public.error_reports
  for select
  using (auth.uid() = user_id);

-- 刻意不建立 update / delete policy：錯誤紀錄是只增不改的診斷資料，不開放
-- 前端竄改或刪除自己上報過的內容；要清理／保留期限管理，由專案擁有者
-- 直接在 Supabase Dashboard 手動刪除即可。

-- ----------------------------------------------------------------------------
-- 前端開關：App 的「☁️ 雲端同步」設定區有「🐞 自動上報錯誤紀錄」選項
-- （appSettings.autoErrorReport），預設關閉；即使開啟，也必須先登入
-- （有有效的 access token）才會實際送出，未登入或未設定雲端連線一律不送。
-- ----------------------------------------------------------------------------
