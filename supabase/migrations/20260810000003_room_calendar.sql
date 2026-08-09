-- room_calendar: one place that knows when a room is occupied.
--
-- There is no such place today. Availability is spread across
-- rooms.next_available, rooms.available_until, rooms.upcoming_bookings (jsonb),
-- onboarding_progress tenancy dates, property_viewings, soft_reserves and
-- rooms.held_until. Nothing reconciles them, which is how a stale
-- next_available has more than once hidden a sellable room.
--
-- Distribution makes that worse, not better: once eleven platforms can send us
-- bookings, "when is this room free" has to have exactly one answer.
--
-- Deliberately NOT overwriting rooms.next_available in this migration. The
-- live site reads that column. This ships the calendar and the derivation
-- side by side, plus a drift view, so the two can be compared on real data
-- before anything switches over. Same reason the listing channels ship
-- disabled: verify, then cut over.

begin;

create table if not exists public.room_calendar (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.rooms(id) on delete cascade,

  starts_on    date not null,
  -- Null means open-ended: a tenancy with no agreed end date. Treated as
  -- occupied indefinitely, which is the safe reading.
  ends_on      date,

  kind         text not null check (kind in
                 ('TENANCY','PLATFORM_BOOKING','ENQUIRY','VIEWING','HOLD','BLOCK')),

  -- 'internal' or a listing_channels.slug. This is what lets us answer
  -- "which platform sold this room" without guessing.
  source       text not null default 'internal',
  external_ref text,

  status       text not null default 'ACTIVE'
               check (status in ('ACTIVE','CANCELLED')),

  -- Whether this entry actually takes the room off the market.
  --
  -- Mark's rule: an ENQUIRY records but never blocks, a confirmed
  -- PLATFORM_BOOKING blocks. Viewings never block, because Mark deliberately
  -- runs viewings on rooms that already carry a booking.
  blocks       boolean not null default true,

  -- Set when an automated inbound event created this row, so an auto-block
  -- that turns out to be a parsing error can be found and reversed. A silent
  -- false positive here takes a sellable room off eleven platforms at once.
  auto_created boolean not null default false,

  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint room_calendar_dates_sane check (ends_on is null or ends_on >= starts_on)
);

create index if not exists room_calendar_room_idx on public.room_calendar (room_id, starts_on);
create index if not exists room_calendar_blocking_idx
  on public.room_calendar (room_id, starts_on)
  where status = 'ACTIVE' and blocks;
create unique index if not exists room_calendar_external_key
  on public.room_calendar (source, external_ref)
  where external_ref is not null;

comment on table public.room_calendar is
  'Single source of truth for when a room is occupied. Rows arrive from '
  'tenancies, platform bookings, holds and manual blocks. rooms.next_available '
  'becomes a derived value rather than a hand-edited field.';

comment on column public.room_calendar.blocks is
  'Whether this entry takes the room off the market. Enquiries and viewings do '
  'not: Mark deliberately runs viewings on rooms that already carry a booking.';

-- ── Inbound events, raw ─────────────────────────────────────────────────────
-- Everything a platform tells us, captured before interpretation. Kept raw and
-- separate so a parsing bug can be re-run over history instead of losing the
-- original signal.
create table if not exists public.inbound_events (
  id            uuid primary key default gen_random_uuid(),
  channel_slug  text not null,
  -- How we heard about it. 'email' resolves via a per-account wake address,
  -- so a confirmation tells us WHICH account it belongs to, not merely that
  -- something happened.
  detector      text not null check (detector in ('email','ical','browser','webhook')),

  external_ref  text,
  event_type    text not null default 'UNKNOWN'
                check (event_type in ('BOOKING','ENQUIRY','CANCELLATION','UNKNOWN')),

  room_id       uuid references public.rooms(id) on delete set null,
  payload       jsonb not null default '{}'::jsonb,
  raw           text,

  processed_at  timestamptz,
  calendar_id   uuid references public.room_calendar(id) on delete set null,
  error         text,

  received_at   timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create unique index if not exists inbound_events_dedupe
  on public.inbound_events (channel_slug, detector, external_ref)
  where external_ref is not null;
create index if not exists inbound_events_unprocessed_idx
  on public.inbound_events (received_at)
  where processed_at is null;

comment on table public.inbound_events is
  'Raw inbound signal from external platforms, captured before interpretation '
  'so a parsing bug can be replayed over history rather than losing the event.';

-- ── Derived availability ────────────────────────────────────────────────────
-- The earliest date from `from_date` onward that is not covered by an active
-- blocking entry. Open-ended entries (ends_on null) mean never available.
create or replace function public.fn_room_next_available(p_room_id uuid, p_from date default current_date)
returns date
language plpgsql
stable
as $$
declare
  cursor_date date := p_from;
  blocked_to  date;
begin
  loop
    select max(coalesce(c.ends_on, 'infinity'::date))
      into blocked_to
      from public.room_calendar c
     where c.room_id = p_room_id
       and c.status = 'ACTIVE'
       and c.blocks
       and c.starts_on <= cursor_date
       and (c.ends_on is null or c.ends_on >= cursor_date);

    if blocked_to is null then
      return cursor_date;              -- nothing covers this date
    end if;
    if blocked_to = 'infinity'::date then
      return null;                     -- occupied with no agreed end
    end if;

    -- Free the day after the block ends, then re-test: back-to-back bookings
    -- must chain rather than reporting a gap that does not exist.
    cursor_date := blocked_to + 1;
  end loop;
end;
$$;

comment on function public.fn_room_next_available is
  'Derived availability from room_calendar. Chains back-to-back blocks so a '
  'handover with no gap is not reported as a free day.';

-- Side-by-side comparison. rooms.next_available is NOT overwritten here: the
-- live site reads it, so the two run in parallel until this view is empty or
-- explained.
create or replace view public.v_room_availability_drift as
select r.id as room_id,
       r.unit_code,
       r.next_available            as stored_next_available,
       public.fn_room_next_available(r.id) as derived_next_available
  from public.rooms r
 where r.room_type is not null
   and r.next_available is distinct from public.fn_room_next_available(r.id);

comment on view public.v_room_availability_drift is
  'Rooms where the hand-maintained next_available disagrees with the calendar. '
  'Must be empty or fully explained before anything is switched to derived.';

-- ── Timestamps + RLS ────────────────────────────────────────────────────────
drop trigger if exists trg_room_calendar_updated_at on public.room_calendar;
create trigger trg_room_calendar_updated_at
  before update on public.room_calendar
  for each row execute function public.update_updated_at();

alter table public.room_calendar  enable row level security;
alter table public.inbound_events enable row level security;

do $$
declare t text;
begin
  foreach t in array array['room_calendar','inbound_events'] loop
    execute format('drop policy if exists "Admin manage %1$s" on public.%1$I', t);
    execute format($p$
      create policy "Admin manage %1$s" on public.%1$I for all
      using (exists (
        select 1 from public.tenant_profiles tp
         where tp.user_id = auth.uid()
           and tp.role = any (array['ADMIN','SUPER_ADMIN'])
           and tp.is_active = true))
    $p$, t);
  end loop;
end $$;

-- ── Seed from what we already know ──────────────────────────────────────────

-- 1. Tenancies of active tenants.
insert into public.room_calendar (room_id, starts_on, ends_on, kind, source, external_ref, notes)
select tp.room_id, op.tenancy_start_date, op.tenancy_end_date, 'TENANCY', 'internal',
       'tenancy:' || tp.id::text,
       'seeded from onboarding_progress'
  from public.onboarding_progress op
  join public.tenant_profiles tp on tp.id = op.tenant_profile_id
 where tp.is_active
   and tp.room_id is not null
   and op.tenancy_start_date is not null
on conflict do nothing;

-- 2. Platform bookings already recorded in the rooms.upcoming_bookings jsonb.
--    Shape: [{"guest","guests","nights","channel","checkin","checkout"}].
--    checkout is a departure date, so the room is occupied to the night before.
insert into public.room_calendar (room_id, starts_on, ends_on, kind, source, external_ref, notes)
select r.id,
       (b->>'checkin')::date,
       case when b->>'checkout' is not null then ((b->>'checkout')::date - 1) end,
       'PLATFORM_BOOKING',
       coalesce(nullif(b->>'channel',''), 'internal'),
       'upcoming:' || r.unit_code || ':' || (b->>'checkin'),
       concat_ws(' ', 'seeded from rooms.upcoming_bookings', nullif(b->>'guest',''))
  from public.rooms r
  cross join lateral jsonb_array_elements(r.upcoming_bookings) b
 where jsonb_typeof(r.upcoming_bookings) = 'array'
   and b->>'checkin' is not null
on conflict do nothing;

-- 3. Live holds.
insert into public.room_calendar (room_id, starts_on, ends_on, kind, source, external_ref, notes)
select r.id, current_date, (r.held_until at time zone 'Asia/Singapore')::date,
       'HOLD', 'internal', 'hold:' || r.unit_code,
       concat('seeded hold, contact: ', coalesce(r.hold_contact,'unknown'))
  from public.rooms r
 where r.held_until is not null
   and r.held_until > now()
on conflict do nothing;

commit;
