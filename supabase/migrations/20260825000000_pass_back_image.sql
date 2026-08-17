-- A work pass is a card. We only ever asked for one side of it.
--
-- tenant_details already holds id_front_url and id_back_url for the NRIC,
-- but the pass had a single pass_url, so for every foreign tenant on file we
-- hold the front of the card and nothing else. The back carries the sector,
-- the employer and the FIN issue details, which is the half that matters if
-- MOM ever asks us to show who is living in the room.
--
-- pass_url keeps its meaning as the front rather than being renamed. Three
-- call sites read it and every row on file uses it, so a rename buys tidiness
-- at the cost of a migration that can half-apply. The comment carries the
-- meaning instead.

alter table public.tenant_details
  add column if not exists pass_back_url text;

comment on column public.tenant_details.pass_url is
  'Front of the pass card. Named before there was a back; kept for the rows that already use it.';

comment on column public.tenant_details.pass_back_url is
  'Back of the pass card. Not collected for a passport or an IPA letter, neither of which has one.';
