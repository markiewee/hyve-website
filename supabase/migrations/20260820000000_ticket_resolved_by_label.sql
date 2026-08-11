-- 20260820000000_ticket_resolved_by_label.sql
--
-- resolved_by is a uuid pointing at a portal account. The closing chain in
-- #80 falls back to naming the calling key when no human is given, and an
-- agent key is not an account: writing its name into a uuid column failed
-- the type check, the failure surfaced as "No such ticket", and closing any
-- ticket at all stopped working in production.
--
-- So the two kinds of closer get two columns. A real account keeps the
-- foreign key it always had; an agent, or a captain named by hand, gets a
-- text label. Either satisfies the requirement to say who, which was the
-- point.

alter table public.maintenance_tickets
  add column if not exists resolved_by_label text;

comment on column public.maintenance_tickets.resolved_by_label is
  'Who closed it when the closer is not a portal user: an agent key, a captain named by hand. resolved_by stays a uuid for real accounts.';
