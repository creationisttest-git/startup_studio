-- Default-deny row-level security starter.
--
-- Start from this rather than from an empty table with a policy added later. The window
-- between creating a table and writing its policy is a public database, and on a project
-- whose anonymous key ships in every page, "temporarily open" means "open to everyone".
--
-- The shape is always the same:
--   1. create the table
--   2. enable RLS in the same migration
--   3. revoke the defaults
--   4. grant only what a role genuinely needs
--   5. write one policy per operation, never a blanket one
--
-- Run steps 1 to 4 together. Never ship a migration that does 1 without 2.

-- ---------------------------------------------------------------- example table

create table if not exists public.item (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users (id) on delete cascade,
  status       text not null default 'draft'
               check (status in ('draft', 'pending', 'published', 'rejected')),
  title        text not null,
  body         text,
  deleted_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Policies are evaluated per row. Without these indexes every read is a sequential scan
-- once the table is real.
create index if not exists item_owner_idx  on public.item (owner_id);
create index if not exists item_status_idx on public.item (status) where deleted_at is null;

-- ---------------------------------------------------------------- step 2, always together

alter table public.item enable row level security;

-- Table owners and superusers bypass RLS silently. Force it so a policy gap shows up in
-- development rather than in production.
alter table public.item force row level security;

-- ---------------------------------------------------------------- step 3, revoke defaults

-- Do not rely on platform defaults. State the grants so a reviewer can read the intent.
revoke all on public.item from anon, authenticated;

-- ---------------------------------------------------------------- step 4, grant narrowly

grant select                         on public.item to anon;
grant select, insert, update, delete on public.item to authenticated;

-- ---------------------------------------------------------------- step 5, one per operation

-- PUBLIC READ. This is the policy that leaks data if written carelessly.
--
-- Never `using (true)` on a table holding drafts, pending, rejected or soft-deleted rows.
-- The anonymous key is in every page, so a permissive read policy is a public read.
create policy item_anon_select on public.item
  for select
  to anon
  using (status = 'published' and deleted_at is null);

-- OWNER READ. Owners see their own rows in every state, including drafts.
create policy item_owner_select on public.item
  for select
  to authenticated
  using (owner_id = (select auth.uid()));

-- OWNER INSERT. `with check` stops a caller inserting a row owned by someone else.
create policy item_owner_insert on public.item
  for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

-- OWNER UPDATE. Both clauses are required. `using` decides which rows are visible to the
-- update; `with check` decides what they may become. Omitting `with check` lets a caller
-- reassign their own row to another owner.
create policy item_owner_update on public.item
  for update
  to authenticated
  using      (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- OWNER DELETE. Prefer a soft delete in product code; this is the hard path.
create policy item_owner_delete on public.item
  for delete
  to authenticated
  using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------- verify, do not assume
--
-- Every table in the public schema should appear here with rowsecurity = true.
--
--   select relname, relrowsecurity, relforcerowsecurity
--   from pg_class
--   where relnamespace = 'public'::regnamespace and relkind = 'r';
--
-- And every policy should be readable in one place. Look for `qual` of `true` on a select
-- policy granted to anon; that is the leak, and it is easy to miss in a diff.
--
--   select tablename, policyname, roles, cmd, qual, with_check
--   from pg_policies
--   where schemaname = 'public'
--   order by tablename, cmd;
--
-- Then test as the anonymous role rather than trusting the policy text:
--
--   set role anon;
--   select count(*) from public.item;   -- must return published rows only
--   reset role;
