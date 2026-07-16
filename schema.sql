-- ============================================================================
-- schema.sql — 「計畫表」雲端同步用資料表
-- ----------------------------------------------------------------------------
-- 在 Supabase 專案的 SQL Editor 貼上整份檔案並執行一次即可。
-- 用途：儲存每個登入使用者「一整包」備份 JSON（等同 App 內「備份」匯出的內容），
-- 供多裝置之間 last-write-wins 同步，不是逐筆行程的關聯式資料表。
-- ============================================================================

create table if not exists public.sync_state (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  payload    jsonb not null,
  updated_at timestamptz not null default now()
);

comment on table public.sync_state is '每位使用者一列，payload 存整包行程表備份 JSON（等同 exportBackup() 的內容），updated_at 用於 last-write-wins 同步判斷。';
comment on column public.sync_state.payload is '等同 app.js buildBackupPayload() / exportBackup() 產生的完整備份物件。';
comment on column public.sync_state.updated_at is '由下面的 trigger 在每次 insert/update 時強制寫入 now()，避免用戶端時間被竄改影響同步判斷。';

-- 開啟 RLS：預設拒絕所有存取，只靠下面的 policy 開放。
alter table public.sync_state enable row level security;

-- 只有本人（auth.uid() 等於該列 user_id）能讀到自己的資料。
drop policy if exists "sync_state_select_own" on public.sync_state;
create policy "sync_state_select_own"
  on public.sync_state
  for select
  using (auth.uid() = user_id);

-- 只有本人能新增「自己 user_id」的那一列。
drop policy if exists "sync_state_insert_own" on public.sync_state;
create policy "sync_state_insert_own"
  on public.sync_state
  for insert
  with check (auth.uid() = user_id);

-- 只有本人能更新自己的那一列。
drop policy if exists "sync_state_update_own" on public.sync_state;
create policy "sync_state_update_own"
  on public.sync_state
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 預設不開放 delete（App 目前沒有「清除雲端資料」功能）。
-- 若之後想加這個功能，取消下面註解即可：
-- drop policy if exists "sync_state_delete_own" on public.sync_state;
-- create policy "sync_state_delete_own"
--   on public.sync_state
--   for delete
--   using (auth.uid() = user_id);

-- 由資料庫端強制寫入 updated_at = now()，不信任用戶端傳來的時間，
-- 這樣即使某台裝置系統時間不準，last-write-wins 的比較仍然可靠。
create or replace function public.sync_state_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_sync_state_updated_at on public.sync_state;
create trigger trg_sync_state_updated_at
  before insert or update on public.sync_state
  for each row
  execute function public.sync_state_set_updated_at();
