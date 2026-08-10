-- Partner API v1.1: confirmed bookings through the API, and an `internal`
-- key scope so our own agents use keys instead of service credentials.
--
-- A booking is a confirmed hold: unlike a booking_request (a lead we vet),
-- it blocks the calendar the moment it lands. Overlaps are accepted by
-- design: Mark deliberately overbooks (viewings on rooms with bookings),
-- so nothing here checks for or refuses a collision.

begin;

create table if not exists public.channel_bookings (
  id              uuid primary key default gen_random_uuid(),
  channel_id      uuid not null references public.listing_channels(id) on delete restrict,
  room_id         uuid not null references public.rooms(id) on delete restrict,
  external_ref    text,
  idempotency_key text,
  starts_on       date not null,
  -- Null means open-ended, same reading as room_calendar.
  ends_on         date,
  guest           jsonb not null default '{}'::jsonb,
  status          text not null default 'confirmed'
                  check (status in ('confirmed','cancelled')),
  calendar_id     uuid references public.room_calendar(id) on delete set null,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint channel_bookings_dates_sane check (ends_on is null or ends_on >= starts_on)
);
create unique index if not exists channel_bookings_idem_key
  on public.channel_bookings (channel_id, idempotency_key)
  where idempotency_key is not null;
create index if not exists channel_bookings_channel_idx
  on public.channel_bookings (channel_id, created_at desc);
create index if not exists channel_bookings_room_idx
  on public.channel_bookings (room_id, starts_on);

alter table public.channel_bookings enable row level security;

-- Key scope: partner keys see the public surface; internal keys (our own
-- agents) additionally report listing placements. Stored on the key, not the
-- channel, so one channel could hold both kinds during a migration.
alter table public.channel_api_keys
  add column if not exists scope text not null default 'partner'
  check (scope in ('partner','internal'));

-- booking.updated fan-out, to the owning channel only. All record field
-- access stays inside the per-table branch: the v1 version of the enqueue
-- function referenced a column structurally absent from other row types and
-- took every caller's write down with it for thirteen minutes.
create or replace function public.fn_partner_enqueue_booking_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payload jsonb;
begin
  v_payload := jsonb_build_object(
    'table', 'channel_bookings',
    'change', lower(tg_op),
    'occurred_at', now(),
    'booking_id', new.id
  );
  insert into public.webhook_deliveries (subscription_id, event_type, payload)
  select s.id, 'booking.updated', v_payload
  from public.webhook_subscriptions s
  where s.active
    and 'booking.updated' = any(s.events)
    and s.channel_id = new.channel_id;
  return null;
end;
$$;

drop trigger if exists trg_partner_events_bookings on public.channel_bookings;
create trigger trg_partner_events_bookings
  after insert or update of status on public.channel_bookings
  for each row execute function public.fn_partner_enqueue_booking_event();

commit;
