-- 20260819000000_lead_pipeline_stages.sql
--
-- The leads table has 239 rows and no notion of a stage being overdue, so
-- it silts up: 122 sit at "qualified" with 53 of those untouched for more
-- than a week, and 19 of the 22 at "new" have never been triaged at all.
-- A prospect nobody moved is not a pipeline, it is a list.
--
-- Every stage gets its own patience, because they are not alike. A brand
-- new enquiry going quiet for two days is a dead lead. A viewing that was
-- booked and never given an outcome is a failure of ours, not theirs, and
-- it should be chased hard and early. A closed lead is finished and is not
-- stale, it is done.
--
-- Additive and idempotent: one config table, one view, no data touched.

create table if not exists public.lead_stage_policy (
  status         text primary key,
  patience_days  integer not null,
  is_terminal    boolean not null default false,
  owner_hint     text,
  why            text
);

comment on table public.lead_stage_policy is
  'How long a lead may sit in each status before it needs moving. Policy, editable without a deploy.';

insert into public.lead_stage_policy (status, patience_days, is_terminal, owner_hint, why) values
  ('new',            2,  false, 'reply or close',
   'A first enquiry that goes quiet for two days is a dead lead. Mark''s standing rule: just close it.'),
  ('qualified',      5,  false, 'book the viewing or close',
   'They want a room and we know what they want. Five days of nothing means we lost them or forgot them.'),
  ('viewing_booked', 2,  false, 'confirm, or record what happened',
   'A booked viewing with no outcome recorded is our failure, not theirs, and it is the most expensive kind.'),
  ('viewing_done',   2,  false, 'send the agreement or close',
   'They came and looked. This is the shortest fuse in the pipeline: interest decays in days.'),
  ('agreement_sent', 3,  false, 'chase the signature',
   'An unsigned agreement is a deal that has not happened yet.'),
  ('signed',         1,  false, 'start onboarding',
   'Signed and not onboarding means somebody is about to move into a room nobody prepared.'),
  ('cold',          30,  false, 'revive or close',
   'Parked on purpose. Worth one look a month, not a daily nag.'),
  ('closed_won',     0,  true,  null, 'Done.'),
  ('closed_lost',    0,  true,  null, 'Done.'),
  ('lost',           0,  true,  null, 'Done.')
on conflict (status) do nothing;

create or replace view public.v_leads_stalled as
  select
    l.id,
    l.name,
    l.phone_e164,
    l.status,
    l.lifecycle,
    l.next_action,
    l.matched_room_codes,
    l.budget_monthly,
    l.updated_at,
    (current_date - l.updated_at::date)      as days_still,
    p.patience_days,
    p.owner_hint,
    (current_date - l.updated_at::date) - p.patience_days as days_over,
    c.slug                                   as channel
  from public.leads l
  join public.lead_stage_policy p on p.status = l.status
  left join public.listing_channels c on c.id = l.channel_id
  where not p.is_terminal
    -- A STORED lead is parked against a condition and is the activator's
    -- business, not the chaser's. Counting it as stalled would mean nagging
    -- about somebody who told us to come back in November.
    and coalesce(l.lifecycle, 'ACTIVE') <> 'STORED'
    and (current_date - l.updated_at::date) > p.patience_days;

comment on view public.v_leads_stalled is
  'Leads past the patience their stage allows. Terminal statuses and STORED leads are excluded by design.';
