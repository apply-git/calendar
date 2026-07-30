-- ============================================================================
-- schema-history.sql — 「計畫表」雲端備份版本歷史（誤覆蓋救援用）
-- ----------------------------------------------------------------------------
-- 在 Supabase 專案的 SQL Editor 貼上整份檔案並執行一次即可（選用功能，
-- 不執行也不影響既有的 schema.sql / sync_state 同步功能）。
--
-- 用途：sync.js 每次成功把資料推送到雲端（sync_state）時，會「順便」把同一包
-- 備份 JSON 額外存一份快照進這張表，最多保留每位使用者最新 10 份；
-- 若某次同步不小心把別台裝置的正確資料覆蓋掉，可以從這裡挑一份較早的快照
-- 一鍵還原回本機並重新同步上去，不必依賴使用者自己手動存的備份檔。
-- ============================================================================

create table if not exists public.sync_history (
  id         bigserial primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  payload    jsonb not null,
  created_at timestamptz not null default now()
);

comment on table public.sync_history is '雲端備份版本歷史：每次推送到 sync_state 時額外留存一份快照，供誤覆蓋時一鍵回復，每位使用者最多保留 10 份。';
comment on column public.sync_history.payload is '等同 app.js buildBackupPayload() 產生的完整備份物件，與 sync_state.payload 同格式。';
comment on column public.sync_history.created_at is '這份快照建立的時間，前端依此由新到舊排序並修剪超過 10 份的舊快照。';

-- 依 (user_id, created_at desc) 建索引，加速「列出某使用者最新 N 份快照」與修剪舊版本的查詢。
create index if not exists sync_history_user_id_created_at_idx
  on public.sync_history (user_id, created_at desc);

-- 開啟 RLS：預設拒絕所有存取，只靠下面的 policy 開放。
alter table public.sync_history enable row level security;

-- 只有本人（auth.uid() 等於該列 user_id）能讀到自己的快照。
drop policy if exists "sync_history_select_own" on public.sync_history;
create policy "sync_history_select_own"
  on public.sync_history
  for select
  using (auth.uid() = user_id);

-- 只有本人能新增「自己 user_id」的快照。
drop policy if exists "sync_history_insert_own" on public.sync_history;
create policy "sync_history_insert_own"
  on public.sync_history
  for insert
  with check (auth.uid() = user_id);

-- 只有本人能刪除自己的快照（前端修剪超過 10 份的舊版本需要用到）。
drop policy if exists "sync_history_delete_own" on public.sync_history;
create policy "sync_history_delete_own"
  on public.sync_history
  for delete
  using (auth.uid() = user_id);
