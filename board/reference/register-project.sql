-- Register one project on the shared board backend.
--
-- Run AFTER tickets-schema.sql, in the SQL editor. Safe to re-run: every statement is
-- idempotent. Replace the four placeholders before running.

-- 1. The project itself.
insert into public.board_project (slug, name, ticket_prefix)
  values ('<your-slug>', '<Your Project>', '<ABC>')
  on conflict (slug) do nothing;


-- 2. Optional: restrict who a ticket may be assigned to.
--
-- Leave this out entirely for no restriction, which is the default. Set it only if you want
-- typo protection, and set it to YOUR vocabulary. It used to be a fixed list of three names
-- baked into the schema, which made any board using different ones impossible to migrate.

-- update public.board_project set assignees = array['SQUAD','FOUNDER','CC']
--  where slug = '<your-slug>';


-- 3. Membership. Membership is the ONLY thing that grants access. Nothing in board.html
--    grants anything, and the allow-list there is a courtesy gate, not a control.
--
--    Both users must already exist: a person by signing in once, the bot by being created in
--    the auth panel.
--
--    The bot user belongs to THIS project only. One bot per project, never shared: a bot that
--    is a member of two boards can reach both, which is the thing the isolation model exists
--    to prevent.

insert into public.board_member (project_id, user_id)
select p.id, '<PERSON-USER-UUID>'::uuid
from public.board_project p where p.slug = '<your-slug>'
on conflict do nothing;

insert into public.board_member (project_id, user_id)
select p.id, '<BOT-USER-UUID>'::uuid
from public.board_project p where p.slug = '<your-slug>'
on conflict do nothing;


-- 4. Confirm what was created. Two rows expected.
select p.slug, p.name, p.ticket_prefix, p.assignees, m.user_id
from public.board_project p
join public.board_member m on m.project_id = p.id
where p.slug = '<your-slug>';
