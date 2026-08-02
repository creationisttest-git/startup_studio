-- PROJECT internal ticket board (board.html)
-- Run this in the Supabase SQL editor (project <your-project-ref>).
-- Safe to re-run: it creates the table if missing, upgrades an existing one, and only seeds when empty.
--
-- A ticket has ONE status. Statuses map to board columns by a hard-coded rule in board.html
-- (uat_complete shows in the UAT column). Statuses, in order:
--   backlog -> todo -> in_progress -> uat -> uat_complete -> prod_ready -> prod_deployed -> done
-- release_version: tagged by Claude Code only (UI shows it read-only).
-- Assignees: SQUAD (Claude Code PROJECT Squad), FOUNDER, CC.

create table if not exists public.tickets (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  description     text not null default '',
  status          text not null default 'backlog',
  release_version text,
  assignee        text,
  position        double precision not null default 0,
  images          jsonb not null default '[]'::jsonb,
  created_by      uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- â”€â”€ Upgrade path for an existing table â”€â”€
alter table public.tickets add column if not exists release_version text;
alter table public.tickets drop column if exists stage_status;

-- Migrate the old column values to the new statuses (UAT Deployed -> uat, old PROD Deployed -> prod_ready).
-- Drop the status check first so the data can move, then re-add it with the new set.
alter table public.tickets drop constraint if exists tickets_status_check;
update public.tickets set status = 'uat'        where status = 'uat_deployed';
update public.tickets set status = 'prod_ready' where status = 'prod_deployed';
alter table public.tickets add constraint tickets_status_check
  check (status in ('backlog','todo','in_progress','uat','uat_complete','prod_ready','prod_deployed','done'));

-- Every ticket now has a status that matches its column. Tag the UAT tickets with the current
-- UAT release version (Claude Code re-tags per build going forward).
update public.tickets set release_version = 'uat-20260715'
  where status in ('uat','uat_complete') and (release_version is null or release_version = '');

alter table public.tickets drop constraint if exists tickets_stage_status_check;

alter table public.tickets drop constraint if exists tickets_assignee_check;
alter table public.tickets add constraint tickets_assignee_check
  check (assignee is null or assignee in ('SQUAD','FOUNDER','CC'));

create index if not exists tickets_status_position_idx on public.tickets (status, position);

-- â”€â”€ Ticket numbers: every ticket gets an auto-generated integer `num`, shown in the UI as MUS-<num>.
--    The number is read-only in board.html and assigned automatically on insert (sequence default).
create sequence if not exists tickets_num_seq;
alter table public.tickets add column if not exists num integer;
-- Backfill any unnumbered tickets in creation order, continuing past the current max.
do $$
begin
  if exists (select 1 from public.tickets where num is null) then
    update public.tickets t set num = o.rn + coalesce((select max(num) from public.tickets), 0)
    from (select id, row_number() over (order by created_at, id) as rn
          from public.tickets where num is null) o
    where t.id = o.id;
  end if;
end $$;
-- Advance the sequence past the highest existing number, then make it the default for new rows.
select setval('tickets_num_seq', coalesce((select max(num) from public.tickets), 0), true);
alter table public.tickets alter column num set default nextval('tickets_num_seq');
create unique index if not exists tickets_num_key on public.tickets (num);

-- â”€â”€ Access: only the two team members can read or write â”€â”€
alter table public.tickets enable row level security;
grant select, insert, update, delete on public.tickets to authenticated;

drop policy if exists tickets_team_all on public.tickets;
create policy tickets_team_all on public.tickets
  for all
  to authenticated
  using ( auth.uid() in (
    '<team-member-uid-1>',
    '<team-member-uid-2>'
  ) )
  with check ( auth.uid() in (
    '<team-member-uid-1>',
    '<team-member-uid-2>'
  ) );

do $$
begin
  begin
    alter publication supabase_realtime add table public.tickets;
  exception when duplicate_object then null; when undefined_object then null;
  end;
end $$;

-- â”€â”€ Seed: only when the board is empty (existing boards are untouched) â”€â”€
do $$
begin
if not exists (select 1 from public.tickets) then
  insert into public.tickets (title, description, status, assignee, position) values
    ('58 - Browser back + mobile swipe navigation', 'Seeded item.', 'todo', 'SQUAD', 1),
    ('33.3 - Follows page redesign', 'Seeded item.', 'todo', 'SQUAD', 2);
end if;
end $$;
