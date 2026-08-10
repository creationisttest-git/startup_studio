-- Prove the isolation rather than trusting the policy text.
--
-- Run in the SQL editor AFTER tickets-schema.sql and register-project.sql, and again after
-- the first ticket exists. Paste the raw output back; a summary is not evidence.
--
-- A control nobody has seen fail is a control nobody has tested.


-- CHECK 1. The anonymous role must reach nothing.
--
-- The publishable key is embedded in board.html and is public by definition. Anyone can call
-- the data API with it. This is the check that says what they get.
--
-- REQUIRED RESULT: 0.
-- Any other number means every ticket on every board here is publicly readable. Stop and
-- report it. Do not create tickets on a board that fails this.
--
-- Note for whoever automates this: a script that treats any SQL error as fatal will read
-- this check's permission denial as a failure when it is in fact the strongest possible pass.

set role anon;
select count(*) as anon_visible_tickets from public.tickets;
reset role;


-- CHECK 2. Row-level security is on AND forced on all three tables.
--
-- force matters: without it the table owner bypasses its own policies, so a gap shows up in
-- production rather than in development.
--
-- REQUIRED RESULT: three rows, both boolean columns true on every one.

select relname,
       relrowsecurity      as rls_enabled,
       relforcerowsecurity as rls_forced
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in ('tickets','board_project','board_member')
order by relname;


-- CHECK 3. Hard delete is impossible for the signed-in role.
--
-- Deletion is soft: a ticket is flagged and hidden, never removed. The flag is a convention;
-- this revoke is the control. Without it, anyone with the publishable key and a shell can
-- destroy a ticket whatever the page chooses to send.
--
-- REQUIRED RESULT: 0 rows.

select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'tickets'
  and grantee = 'authenticated' and privilege_type = 'DELETE';


-- CHECK 4. Ticket counts by project.
--
-- Run as the SQL editor's privileged role this shows every board, which is expected here.
-- The meaningful version is the CLI's whoami, which runs as the bot user and must show this
-- project's count only.

select p.slug, count(t.id) as tickets
from public.board_project p
left join public.tickets t on t.project_id = p.id and t.deleted_at is null
group by p.slug
order by p.slug;


-- CHECK 5, the negative control, and the only one that proves anything on its own.
--
-- The four checks above confirm a bot sees what it should. None of them confirms it CANNOT
-- see what it should not, and those are different claims. Run this once there is a second
-- board, or create a throwaway one, leave this bot out of its membership, and confirm:
--
--   point BOARD_PROJECT at that board and run `node board-cli.js whoami`
--
-- REQUIRED RESULT: it refuses with "not visible to this bot user".
-- If it lists tickets instead, the isolation is not working and nothing else here matters.
-- Delete the throwaway board afterwards.
