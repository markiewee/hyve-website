-- Availability sync, part one: Roomies.
--
-- Some platforms have no availability field at all. Roomies is one: a listing is
-- live or it is not, and there is nowhere to put a date. So availability has to
-- ride on the only two things we control there, the on/off state and the
-- headline text.
--
-- Mark's rule: off by default, on when the room opens within three months, with
-- the date in the headline. That threshold is not arbitrary. Viewing to signed
-- to moved-in runs four to eight weeks, so a room opening further out than
-- about twelve weeks is advertising we cannot convert, and every enquiry it
-- pulls is a seeker we disappoint.
--
-- Derived in SQL rather than in the app deliberately. The calendar already
-- lives here (fn_room_next_available), and a second implementation in
-- JavaScript would be a second thing to keep in step. One function, one answer,
-- read by both the cron and the screen.

begin;

-- ── A Lazybee reference a human can read ────────────────────────────────────
-- Every listing everywhere carries this string. It is how we look at a room on
-- Roomies, or in a screenshot from a captain, and know exactly which unit it is
-- without opening the database.
--
-- Format: LZB-<UNIT CODE>, e.g. LZB-CP-PR1, LZB-IH-STD1, LZB-TG-MR.
--
-- Deliberately NOT an opaque number. A sequence like LZB-0007 is unique and
-- useless: nobody can read it in a hurry, and the whole point of putting it on
-- a public listing is that a person can. The unit code already encodes the
-- building and the room, so the reference is the unit code with a prefix that
-- makes it unambiguous and searchable. Searching "CP-PR1" hits noise; searching
-- "LZB-CP-PR1" hits exactly one thing, on any platform, in any inbox.
alter table public.rooms
  add column if not exists lazybee_ref text;

-- Lettable rooms only. The table also holds common areas and yards
-- (CP-COMMON, TG-YARD and friends); a public listing reference for a shared
-- kitchen would be meaningless and would show up in any count of "our rooms".
update public.rooms
   set lazybee_ref = 'LZB-' || upper(unit_code)
 where lazybee_ref is null
   and unit_code is not null
   and room_type is not null;

create unique index if not exists rooms_lazybee_ref_key
  on public.rooms (lazybee_ref) where lazybee_ref is not null;

comment on column public.rooms.lazybee_ref is
  'Human-readable public reference, LZB-<UNIT CODE>. Printed on every external '
  'listing so a room can be identified from the listing alone. Readable on '
  'purpose: an opaque sequence would be unique and useless.';

-- ── Roomies as a channel ────────────────────────────────────────────────────
-- Not present before this. Note roomz.asia (slug `roomz`) is a different site
-- and is already in the table; these are not the same platform.
insert into public.listing_channels (slug, name, mechanism, enabled, config)
values ('roomies', 'Roomies', 'browser', false,
        jsonb_build_object(
          'base_url', 'https://roomies.sg',
          'has_availability_field', false,
          'availability_carrier', 'headline_and_toggle',
          'note', 'No API and no availability field. Chrome extension only: the '
                  'Playwright path was removed on 9 Aug and the standard browser '
                  'escalation ladder does not apply to this platform.'))
on conflict (slug) do nothing;

-- ── Where the desired state is recorded ─────────────────────────────────────
alter table public.listing_placements
  add column if not exists desired_state       jsonb,
  add column if not exists desired_computed_at timestamptz;

comment on column public.listing_placements.desired_state is
  'What this listing SHOULD look like, derived from room_calendar. Compared '
  'against what the platform actually shows; a difference is drift, not a push.';

-- ── The derivation ──────────────────────────────────────────────────────────
create or replace function public.fn_listing_desired_state(
  p_room_id      uuid,
  p_currently_on boolean default false,
  p_today        date    default current_date,
  p_on_days      integer default 90,
  p_off_days     integer default 100
)
returns jsonb
language plpgsql
stable
as $$
declare
  free_from date;
  days_out  integer;
begin
  free_from := public.fn_room_next_available(p_room_id, p_today);

  -- No usable window at all: an open-ended tenancy, or a calendar so full that
  -- nothing of minimum-stay length is free. Nothing honest to advertise.
  if free_from is null then
    return jsonb_build_object(
      'on', false, 'headline', null, 'free_from', null, 'days_out', null,
      'reason', 'occupied with no agreed end date');
  end if;

  days_out := free_from - p_today;

  -- Hysteresis. Turning on at 90 and off at 90 would flap a listing on and off
  -- as a room drifts across the boundary day by day. On at 90, off only past
  -- 100, so a listing that is already live gets ten days of stickiness.
  if days_out > (case when p_currently_on then p_off_days else p_on_days end) then
    return jsonb_build_object(
      'on', false, 'headline', null, 'free_from', free_from, 'days_out', days_out,
      'reason', format('opens in %s days, beyond the %s day window',
                       days_out, case when p_currently_on then p_off_days else p_on_days end));
  end if;

  -- Free today or already past. Never render a date that has been and gone:
  -- "Available from 3 Aug" on the 9th reads as an abandoned listing.
  if days_out <= 0 then
    return jsonb_build_object(
      'on', true, 'headline', 'Available now', 'free_from', free_from,
      'days_out', days_out, 'reason', 'free now');
  end if;

  return jsonb_build_object(
    'on', true,
    'headline', 'Available from ' || to_char(free_from, 'FMDD Mon YYYY'),
    'free_from', free_from, 'days_out', days_out,
    'reason', format('opens in %s days, inside the window', days_out));
end;
$$;

comment on function public.fn_listing_desired_state is
  'Desired state of a listing on a platform with no availability field. Returns '
  '{on, headline, free_from, days_out, reason}. On at 90 days, off past 100, so '
  'a live listing cannot flap across the boundary.';

-- ── The report ──────────────────────────────────────────────────────────────
-- Desired versus actual, per room, for Roomies. A row where on <> is_live is
-- work to do; a row where they agree is nothing to do.
create or replace view public.v_roomies_listing_state as
select r.id                as room_id,
       r.lazybee_ref,
       r.unit_code,
       r.price_monthly,
       r.min_stay_months,
       lp.id               as placement_id,
       lp.external_id      as roomies_listing_id,
       lp.url              as roomies_url,
       coalesce(lp.status = 'LIVE', false) as is_live,
       s.desired
  from public.rooms r
  left join public.listing_channels c   on c.slug = 'roomies'
  left join public.listing_placements lp
         on lp.room_id = r.id and lp.channel_id = c.id
  cross join lateral (
       select public.fn_listing_desired_state(
                r.id, coalesce(lp.status = 'LIVE', false)) as desired
  ) s
 where r.room_type is not null;

comment on view public.v_roomies_listing_state is
  'What each Roomies listing should say versus what it currently is. Rows where '
  'desired->>on disagrees with is_live are the work list.';

-- A view runs with its owner's rights by default, which would quietly hand the
-- anon role everything in listing_placements through the join. security_invoker
-- makes the caller's RLS apply, so a non-admin sees rooms and nothing else.
alter view public.v_roomies_listing_state set (security_invoker = on);
revoke all on public.v_roomies_listing_state from anon;
grant select on public.v_roomies_listing_state to authenticated;

commit;
