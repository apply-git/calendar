-- ============================================================================
-- schema-share.sql — 「計畫表」家庭共享日曆（多帳號共用一份共享行程）
-- ----------------------------------------------------------------------------
-- 在 Supabase 專案的 SQL Editor 貼上整份檔案並執行一次即可（選用功能，
-- 不執行也不影響既有的 schema.sql / sync_state 個人同步功能，兩者完全獨立）。
--
-- 用途：讓多個 Google 帳號（例如家人）共用「一份」共享行程 JSON。
-- 設計：
--   - 邀請碼 = 群組 UUID（share_groups.id）。知道這串碼就能加入群組，
--     不做額外的邀請審核，安全等級足以應付「家人間口頭 / LINE 傳碼」的情境，
--     詳細安全性說明見 CLOUD_SETUP.md「家庭共享（選用）」章節。
--   - 跟 sync_state 一樣是「整包 payload jsonb」同步策略，不是逐筆行程的
--     關聯式資料表：共享行程整包存在 shared_state.payload。
--   - owner_id 在邏輯上視為群組的「當然成員」（不需要額外在 share_members
--     裡幫自己補一列），詳見下面 is_group_member() 的實作說明。
-- ============================================================================

-- gen_random_uuid() 需要 pgcrypto；Supabase 專案通常已內建，這裡用
-- if not exists 保險，避免在少數環境跑這份 SQL 時因缺少擴充功能而失敗。
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 資料表
-- ----------------------------------------------------------------------------

-- 共享群組：一個群組 = 一份共享行程。id 同時也是「邀請碼」。
create table if not exists public.share_groups (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  owner_id   uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.share_groups is '家庭共享群組，一列代表一份共享行程。id（uuid）本身就是邀請碼，知道這串碼即可用 share_members 自行加入。';
comment on column public.share_groups.id is '同時作為邀請碼：把這串 uuid 傳給家人，家人用它 insert 一列到 share_members 即完成加入。邀請碼等同鑰匙，不要公開張貼（見 CLOUD_SETUP.md）。';
comment on column public.share_groups.owner_id is '建立群組的人。擁有踢人／刪除群組的權限；owner 帳號被刪除（auth.users cascade）時，整個群組與其共享行程會一併被清除。';

-- 共享群組的成員名單（owner 以外的人加入群組後在這裡多一列）。
create table if not exists public.share_members (
  group_id  uuid not null references public.share_groups (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

comment on table public.share_members is '共享群組成員名單。一個使用者可以加入多個群組；owner 不強制要求也在這裡有一列（見 is_group_member()），但允許 owner 額外加入自己的列也不影響邏輯。';
comment on column public.share_members.user_id is '成員的 auth.users id。插入這一列（group_id 帶著邀請碼、user_id 帶著自己）就是「用邀請碼加入群組」的完整動作。';

-- 依 user_id 建索引，加速「列出我加入了哪些群組」的查詢
-- （複合主鍵 (group_id, user_id) 的索引以 group_id 為前導欄，查不到 user_id 單獨查詢）。
create index if not exists share_members_user_id_idx
  on public.share_members (user_id);

-- 共享行程本體：整包 payload jsonb，一個群組一列，跟 sync_state 是同一種同步策略。
create table if not exists public.shared_state (
  group_id   uuid primary key references public.share_groups (id) on delete cascade,
  payload    jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table public.shared_state is '共享行程的整包 payload，一個群組一列。App 端勾選「與家人共享」的行程會被收進這裡的 payload，格式與 sync_state.payload 相容（同樣是 buildBackupPayload() 產生的結構的子集）。';
comment on column public.shared_state.payload is '共享行程整包 JSON；哪些欄位會被收進來由前端決定，這裡資料庫端不限制結構。';
comment on column public.shared_state.updated_at is '由下面的 trigger 在每次 insert/update 時強制寫入 now()，避免用戶端時間被竄改影響同步判斷（跟 sync_state 同樣的做法）。';

-- ----------------------------------------------------------------------------
-- Security definer 輔助函式（避免 RLS policy 互查造成「infinite recursion」）
-- ----------------------------------------------------------------------------
-- 背景：如果 share_members 的 SELECT policy 直接在 using() 裡對 share_members
-- 自己下 exists(select 1 from share_members ...) 這種「自己查自己」的子查詢，
-- Postgres 在算這個子查詢時一樣要套用 share_members 的 RLS policy，就會遞迴
-- 呼叫下去，觸發 "infinite recursion detected in policy for relation
-- share_members" 錯誤。share_groups 與 share_members 互查也會有同樣風險。
--
-- 解法（Supabase 常見手法）：把「查詢是否為成員／owner」包成 security definer
-- function。security definer function 以建立者（在 SQL Editor 執行時通常是
-- postgres 這個 table owner）的權限執行，table owner 預設會 bypass RLS，
-- 所以 function 內部的查詢不會再觸發 share_members / share_groups 的 policy，
-- 迴圈就在這裡被切斷。policy 只呼叫 function、不直接互查資料表。
--
-- is_group_member()「成員」的定義刻意包含 owner：owner 建立群組後不需要
-- 額外在 share_members 裡幫自己補一列，也能立刻讀寫 shared_state、看到
-- share_members 名單，行為更直覺、也少一步容易漏掉的前端邏輯。
create or replace function public.is_group_member(gid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    exists (
      select 1 from public.share_groups g
      where g.id = gid and g.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.share_members m
      where m.group_id = gid and m.user_id = auth.uid()
    );
$$;

comment on function public.is_group_member(uuid) is 'security definer：回傳目前登入者是否為指定群組的 owner 或成員。用 security definer 繞開 RLS，避免 policy 內互查造成遞迴；set search_path = public 避免 search_path 被劫持。';

create or replace function public.is_group_owner(gid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.share_groups g
    where g.id = gid and g.owner_id = auth.uid()
  );
$$;

comment on function public.is_group_owner(uuid) is 'security definer：回傳目前登入者是否為指定群組的 owner。用途同 is_group_member()，供「只有 owner 能做」的 policy（踢人、刪群組共享行程）使用。';

-- ----------------------------------------------------------------------------
-- RLS：share_groups
-- ----------------------------------------------------------------------------
alter table public.share_groups enable row level security;

-- 只有本人能以自己為 owner 建立新群組。
drop policy if exists "share_groups_insert_owner" on public.share_groups;
create policy "share_groups_insert_owner"
  on public.share_groups
  for insert
  with check (owner_id = auth.uid());

-- owner 或該群組成員都能讀到群組資訊（is_group_member 已內含 owner 判斷）。
drop policy if exists "share_groups_select_member" on public.share_groups;
create policy "share_groups_select_member"
  on public.share_groups
  for select
  using (public.is_group_member(id));

-- 只有 owner 能刪除群組（連帶 cascade 刪掉 share_members / shared_state）。
drop policy if exists "share_groups_delete_owner" on public.share_groups;
create policy "share_groups_delete_owner"
  on public.share_groups
  for delete
  using (owner_id = auth.uid());

-- ----------------------------------------------------------------------------
-- RLS：share_members
-- ----------------------------------------------------------------------------
alter table public.share_members enable row level security;

-- 只有本人能新增「自己 user_id」的成員列：insert 需要知道 group_id（邀請碼），
-- 這就是「知道邀請碼即可加入」的完整機制，資料庫端不再另外審核。
drop policy if exists "share_members_insert_self" on public.share_members;
create policy "share_members_insert_self"
  on public.share_members
  for insert
  with check (user_id = auth.uid());

-- 同群組成員（含 owner）互相看得到彼此的成員名單。
drop policy if exists "share_members_select_same_group" on public.share_members;
create policy "share_members_select_same_group"
  on public.share_members
  for select
  using (public.is_group_member(group_id));

-- 本人可以自行退出群組；群組 owner 可以踢掉任何成員。
drop policy if exists "share_members_delete_self_or_owner" on public.share_members;
create policy "share_members_delete_self_or_owner"
  on public.share_members
  for delete
  using (user_id = auth.uid() or public.is_group_owner(group_id));

-- ----------------------------------------------------------------------------
-- RLS：shared_state
-- ----------------------------------------------------------------------------
alter table public.shared_state enable row level security;

drop policy if exists "shared_state_select_member" on public.shared_state;
create policy "shared_state_select_member"
  on public.shared_state
  for select
  using (public.is_group_member(group_id));

drop policy if exists "shared_state_insert_member" on public.shared_state;
create policy "shared_state_insert_member"
  on public.shared_state
  for insert
  with check (public.is_group_member(group_id));

drop policy if exists "shared_state_update_member" on public.shared_state;
create policy "shared_state_update_member"
  on public.shared_state
  for update
  using (public.is_group_member(group_id))
  with check (public.is_group_member(group_id));

-- 只有 owner 能刪除共享行程整列（例如「解散共享、只留自己本機」）。
drop policy if exists "shared_state_delete_owner" on public.shared_state;
create policy "shared_state_delete_owner"
  on public.shared_state
  for delete
  using (public.is_group_owner(group_id));

-- ----------------------------------------------------------------------------
-- Trigger：shared_state.updated_at 由資料庫端強制寫入 now()
-- ----------------------------------------------------------------------------
-- 跟 schema.sql 的 sync_state_set_updated_at() 同樣的做法：不信任用戶端傳來的
-- 時間，確保 last-write-wins／前端顯示的「最後更新時間」可靠。
create or replace function public.shared_state_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_shared_state_updated_at on public.shared_state;
create trigger trg_shared_state_updated_at
  before insert or update on public.shared_state
  for each row
  execute function public.shared_state_set_updated_at();
