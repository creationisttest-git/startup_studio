-- Roadmap Actions Kanban -- shared backend, one board per project, hard isolation.
--
-- Run in the Supabase SQL editor. Safe to re-run: it creates what is missing, upgrades an
-- existing single-project board. It DOES touch ticket data: it normalises legacy status
-- values, backfills ticket numbers and image counts, and adopts orphaned rows into a project.
--
-- A ticket has ONE status. Statuses map to board columns by a rule in board.html
-- (uat_complete shows in the UAT column). In order:
--   backlog -> todo -> in_progress -> uat -> uat_complete -> prod_ready -> prod_deployed -> done
--
--
-- ISOLATION MODEL -- read this before changing anything below.
--
-- Every project's tickets live in one table, separated by project_id and enforced by
-- row-level security tied to membership. There are three ways to reach the data and all
-- three go through the same policy:
--
--   UI   board.html signs in with Google and holds the publishable key. RLS applies.
--   API  anyone can call PostgREST with the publishable key. RLS applies.
--   CLI  board-cli.js signs in as a per-project bot USER. RLS applies.
--
-- The CLI is the one that used to leak. It previously authenticated with the service-role
-- key, which bypasses row-level security entirely, so any project holding that key could
-- read and write every other project's board no matter what policies said. A policy cannot
-- defend against a key that is defined as being above policies.
--
-- So: THE SERVICE-ROLE KEY IS NEVER ISSUED TO A PROJECT. It stays with whoever owns this
-- database and is used only to run migrations like this file. Each project gets a bot user
-- and the publishable key, both of which are governed by the policies below.
--
-- Nothing here is defence in depth on top of the CLI being careful. The CLI cannot be
-- trusted, so it was given credentials that do not need to be.


-- ── projects ────────────────────────────────────────────────────────────────────────

create table if not exists public.board_project (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  ticket_prefix text not null,
  assignees     text[],
  created_at    timestamptz not null default now()
);

-- RLS on immediately, in the same breath as the table. Enabling it 200 lines below the
-- create leaves a window where the table exists, is already reachable through the data
-- API, and is wide open. The window only has to be survived once to not matter, and only
-- has to be lost once to matter permanently. With no policies yet, this denies everything,
-- which is the correct state for a table whose policies have not been written.
alter table public.board_project enable row level security;

-- Permitted assignee names, declared per project. Null or empty means no restriction, which
-- is what a new board gets. See tickets_check_assignee below for why this is not a check
-- constraint with a fixed list of values.
alter table public.board_project add column if not exists assignees text[];

-- ── membership: the single source of who may see what ───────────────────────────────

create table if not exists public.board_member (
  project_id uuid not null references public.board_project(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

alter table public.board_member enable row level security;

create index if not exists board_member_user_idx on public.board_member (user_id);

-- Membership is checked from inside the policy on board_member itself, which would recurse.
-- security definer breaks the cycle. search_path is pinned to empty so the function cannot
-- be redirected at a table an attacker controls.
create or replace function public.is_board_member(p uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.board_member m
    where m.project_id = p and m.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_board_member(uuid) from public, anon;
grant execute on function public.is_board_member(uuid) to authenticated;


-- ── tickets ─────────────────────────────────────────────────────────────────────────

create table if not exists public.tickets (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid references public.board_project(id) on delete cascade,
  num             integer,
  title           text not null,
  description     text not null default '',
  status          text not null default 'backlog',
  release_version text,
  assignee        text,
  position        double precision not null default 0,
  images          jsonb not null default '[]'::jsonb,
  image_count     integer not null default 0,
  deleted_at      timestamptz,
  created_by      uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.tickets enable row level security;

alter table public.tickets add column if not exists project_id uuid references public.board_project(id) on delete cascade;
alter table public.tickets add column if not exists num integer;
alter table public.tickets add column if not exists release_version text;

-- board.html selects image_count so it can show an image tag without fetching the images
-- themselves, which is right: the payload is large and the count is all a card needs.
--
-- This column was missing from this file for the whole life of the reference, because the
-- board it was extracted from had it added by hand and never written back. Every fresh
-- install therefore failed its very first query, and failed misleadingly: board.html decides
-- a table is missing by matching the error text for "does not exist", so a missing COLUMN
-- announced itself as a missing TABLE and sent people to re-run this file, which was already
-- correctly applied.
alter table public.tickets add column if not exists image_count integer not null default 0;

-- Soft delete. See the revoke further down, which is the half that actually enforces it.
alter table public.tickets add column if not exists deleted_at timestamptz;

-- Normalise BEFORE constraining. `uat_deployed` is a legacy value that board.html and
-- board-cli.js both still map, so a board carrying it fails this constraint. That failure
-- lands AFTER the drop column above, which is the S18 shape exactly: the run stops with the
-- table already altered and the error reads as a schema bug rather than a data mismatch.
update public.tickets set status = 'uat' where status = 'uat_deployed';

alter table public.tickets drop constraint if exists tickets_status_check;
alter table public.tickets add constraint tickets_status_check
  check (status in ('backlog','todo','in_progress','uat','uat_complete','prod_ready','prod_deployed','done'));

-- Kept dropped, never re-added. Assignees are now validated per project by a trigger.
alter table public.tickets drop constraint if exists tickets_assignee_check;


-- ── permitted assignees, declared per project ───────────────────────────────────────
--
-- This was a check constraint allowing exactly three fixed names. That made an existing
-- board impossible to migrate onto the shared backend: the constraint is added part-way
-- through this file, so a board whose tickets used any other name failed the run with the
-- table already half-altered, and the failure read as a bug in the schema rather than as a
-- mismatch with the data. One real board had 278 rows of 333 that would have failed.
--
-- A null or empty list means no restriction, which is what a new board gets. A project that
-- wants typo protection sets its own list and gets exactly the old behaviour, in its own
-- vocabulary rather than in the vocabulary of whichever project happened to be first.

-- Deliberately NOT security definer. A before-insert trigger runs before the row-level
-- security check, so an elevated function here would answer for any project_id a caller cared
-- to name, and its exception message would hand back that board's permitted assignee list.
-- A real member already has select on their own board_project row, so invoker rights are
-- enough for the legitimate path and return nothing for anyone else.
create or replace function public.tickets_check_assignee()
returns trigger
language plpgsql
set search_path = ''
as $$
declare allowed text[];
begin
  -- `update of assignee` fires whenever the column appears in the SET list, changed or not,
  -- and the UI sends every field on every save. Without this guard, declaring a list makes
  -- every pre-existing ticket holding an older name uneditable: you could not fix a typo in
  -- the description without the save being refused on a field you never touched.
  if tg_op = 'UPDATE' and new.assignee is not distinct from old.assignee then return new; end if;
  if new.assignee is null then return new; end if;
  select p.assignees into allowed from public.board_project p where p.id = new.project_id;
  if allowed is null or array_length(allowed, 1) is null then return new; end if;
  if not (new.assignee = any (allowed)) then
    raise exception 'assignee "%" is not permitted on this board (permitted: %)',
      new.assignee, array_to_string(allowed, ', ');
  end if;
  return new;
end $$;

drop trigger if exists tickets_check_assignee_trg on public.tickets;
create trigger tickets_check_assignee_trg before insert or update of assignee on public.tickets
  for each row execute function public.tickets_check_assignee();


-- ── image_count stays in step with images ───────────────────────────────────────────
--
-- Derived rather than maintained by the client, so a caller that writes images through the
-- API without updating the count cannot put the card out of step with the ticket.

create or replace function public.tickets_sync_image_count()
returns trigger
language plpgsql
as $$
begin
  new.image_count := coalesce(jsonb_array_length(coalesce(new.images, '[]'::jsonb)), 0);
  return new;
end $$;

drop trigger if exists tickets_sync_image_count_trg on public.tickets;
create trigger tickets_sync_image_count_trg before insert or update of images on public.tickets
  for each row execute function public.tickets_sync_image_count();

update public.tickets
   set image_count = coalesce(jsonb_array_length(coalesce(images, '[]'::jsonb)), 0)
 where image_count is distinct from coalesce(jsonb_array_length(coalesce(images, '[]'::jsonb)), 0);


-- ── upgrade path: an existing single-project board ──────────────────────────────────
--
-- Adopts orphaned tickets into one project so nothing is stranded. Set the slug, name and
-- prefix to match the board being migrated BEFORE running this on a live database.

do $$
declare v_project uuid;
begin
  if exists (select 1 from public.tickets where project_id is null) then
    insert into public.board_project (slug, name, ticket_prefix)
      values ('legacy-board', 'Legacy board', 'TKT')
      on conflict (slug) do nothing;
    select id into v_project from public.board_project where slug = 'legacy-board';
    update public.tickets set project_id = v_project where project_id is null;
  end if;
end $$;

-- Only enforce not-null once nothing is orphaned, so a re-run on a fresh database is safe.
do $$
begin
  if not exists (select 1 from public.tickets where project_id is null) then
    alter table public.tickets alter column project_id set not null;
  end if;
end $$;


-- ── ticket numbers, per project ─────────────────────────────────────────────────────
--
-- Each board counts from 1 independently, so two projects can both have a ticket 1. A
-- shared sequence would leak the existence and volume of other projects' work through the
-- gaps in your own numbering.

create unique index if not exists tickets_project_num_key on public.tickets (project_id, num);
create index if not exists tickets_project_status_position_idx on public.tickets (project_id, status, position);

-- Every board query filters out deleted tickets and live ones are the overwhelming majority,
-- so the index only carries the rows actually being scanned.
create index if not exists tickets_live_idx
  on public.tickets (project_id, status, position)
  where deleted_at is null;

create or replace function public.tickets_assign_num()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.num is null then
    -- Serialises concurrent inserts on the same board only. Other boards are unaffected.
    perform pg_advisory_xact_lock(hashtext(new.project_id::text));
    select coalesce(max(t.num), 0) + 1 into new.num
      from public.tickets t where t.project_id = new.project_id;
  end if;
  if new.created_by is null then
    new.created_by := (select auth.uid());
  end if;
  return new;
end $$;

drop trigger if exists tickets_assign_num_trg on public.tickets;
create trigger tickets_assign_num_trg before insert on public.tickets
  for each row execute function public.tickets_assign_num();

-- Backfill numbers for an upgraded board, per project, in creation order.
do $$
begin
  if exists (select 1 from public.tickets where num is null) then
    update public.tickets t set num = o.rn
    from (
      select id, row_number() over (partition by project_id order by created_at, id) as rn
      from public.tickets where project_id is not null
    ) o
    where t.id = o.id and t.num is null;
  end if;
end $$;


-- ── a ticket can never change boards ────────────────────────────────────────────────
--
-- Without this, a member of two projects could move a ticket, and its whole history, from
-- one board to the other. The policy would allow it: both project_ids pass the membership
-- check. Ownership of a ticket is not something an update should be able to rewrite.

create or replace function public.tickets_freeze_project()
returns trigger
language plpgsql
as $$
begin
  if new.project_id is distinct from old.project_id then
    raise exception 'project_id is immutable: a ticket cannot be moved between boards';
  end if;
  return new;
end $$;

drop trigger if exists tickets_freeze_project_trg on public.tickets;
create trigger tickets_freeze_project_trg before update on public.tickets
  for each row execute function public.tickets_freeze_project();


-- ── access ──────────────────────────────────────────────────────────────────────────
--
-- Default deny everywhere. force, so that even the table owner is subject to the policies
-- and a gap shows up in development rather than in production.

alter table public.board_project enable row level security;
alter table public.board_project force  row level security;
alter table public.board_member  enable row level security;
alter table public.board_member  force  row level security;
alter table public.tickets       enable row level security;
alter table public.tickets       force  row level security;

-- The publishable key is embedded in board.html and is therefore public. It gets nothing.
revoke all on public.tickets       from anon, authenticated;
revoke all on public.board_project from anon, authenticated;
revoke all on public.board_member  from anon, authenticated;

-- DELETE is deliberately not granted. Deleting a ticket sets deleted_at and hides it; the
-- row, its number and its whole running record survive, and board-cli.js restore brings it
-- back. Ticket numbers are never reused, because tickets_assign_num takes max(num) across the
-- project and a hidden row still holds its number.
--
-- The revoke is the control, not the column. A flag that the application is merely trusted to
-- honour is not a control at all: PostgREST is reachable directly, so anyone with the
-- publishable key and a shell can issue whatever the page chose not to. Taking the privilege
-- away means a hard delete cannot be issued by the page, by the CLI, or by curl.
--
-- The service-role key still bypasses this. That is the intended escape hatch and it lives
-- with whoever owns this database, not with a project.
grant select, insert, update on public.tickets to authenticated;
revoke delete on public.tickets from authenticated;
grant select on public.board_project to authenticated;
grant select on public.board_member  to authenticated;

drop policy if exists tickets_team_all   on public.tickets;
drop policy if exists tickets_member_all on public.tickets;
create policy tickets_member_all on public.tickets
  for all
  to authenticated
  using      ( public.is_board_member(project_id) )
  with check ( public.is_board_member(project_id) );

-- A member sees the projects they belong to and nothing else, so the board cannot even
-- enumerate the names of other people's projects.
drop policy if exists board_project_member_select on public.board_project;
create policy board_project_member_select on public.board_project
  for select to authenticated
  using ( public.is_board_member(id) );

drop policy if exists board_member_self_select on public.board_member;
create policy board_member_self_select on public.board_member
  for select to authenticated
  using ( public.is_board_member(project_id) );

do $$
begin
  begin
    alter publication supabase_realtime add table public.tickets;
  exception when duplicate_object then null; when undefined_object then null;
  end;
end $$;


-- ── register a project ──────────────────────────────────────────────────────────────
--
-- Run once per board. Then add each human and the project's bot user to board_member.
-- User ids come from the Supabase auth users list.
--
--   insert into public.board_project (slug, name, ticket_prefix)
--     values ('your-slug', 'Your Project', 'ABC')
--     on conflict (slug) do nothing;
--
-- Optionally restrict who a ticket may be assigned to. Leave it null for no restriction.
--
--   update public.board_project set assignees = array['SQUAD','FOUNDER','CC']
--    where slug = 'your-slug';
--
--   insert into public.board_member (project_id, user_id)
--   select p.id, '<user-uuid>'
--   from public.board_project p where p.slug = 'your-slug'
--   on conflict do nothing;
--
--
-- ── verify, rather than trust the policy text ───────────────────────────────────────
--
--   -- must return 0 rows, not an error about permissions being fine
--   set role anon;
--   select count(*) from public.tickets;
--   reset role;
--
--   -- every table below must show rowsecurity and forcerowsecurity true
--   select relname, relrowsecurity, relforcerowsecurity
--   from pg_class
--   where relnamespace = 'public'::regnamespace
--     and relname in ('tickets','board_project','board_member');
--
--   -- signed in as a member of one project, this must return that project's count only
--   select project_id, count(*) from public.tickets group by project_id;
--
--   -- hard delete must be impossible for the signed-in role. This must return no rows.
--   select grantee, privilege_type from information_schema.role_table_grants
--   where table_schema='public' and table_name='tickets'
--     and grantee='authenticated' and privilege_type='DELETE';
--
--   -- the column whose absence used to present as a missing table
--   select count(*) from information_schema.columns
--   where table_schema='public' and table_name='tickets' and column_name='image_count';

-- Destructive, and therefore LAST. Nothing after this line can fail, so no run can leave the
-- table already altered behind an error that reads as a schema bug. `stage_status` was
-- replaced by `status` and is dropped rather than left to rot: a retired column still answers
-- queries, and code written against it looks correct right up until the data stops arriving.
alter table public.tickets drop column if exists stage_status;
