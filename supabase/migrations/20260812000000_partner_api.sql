-- Partner API v1: identity, intake, webhooks, audit.
--
-- A partner IS a listing_channels row (mechanism 'api'). These tables hang
-- off that row. Everything here is reachable only through the service role:
-- the API function authenticates partners itself, so no table below carries
-- an anon or authenticated policy on purpose.

begin;

-- Keys are stored hashed. The plaintext is shown once at mint time and never
-- persisted. rate_limit_per_min lives on the row so a partner can be slowed
-- without a deploy.
create table if not exists public.channel_api_keys (
  id                 uuid primary key default gen_random_uuid(),
  channel_id         uuid not null references public.listing_channels(id) on delete cascade,
  key_hash           text not null unique,
  label              text not null,
  rate_limit_per_min integer not null default 60 check (rate_limit_per_min > 0),
  created_at         timestamptz not null default now(),
  last_used_at       timestamptz,
  revoked_at         timestamptz
);
create index if not exists channel_api_keys_channel_idx on public.channel_api_keys (channel_id);

-- One row per inbound lead or booking request. The ENQUIRY row it creates in
-- room_calendar records but never blocks (Mark's rule); this table is the
-- partner-visible state machine.
create table if not exists public.booking_requests (
  id               uuid primary key default gen_random_uuid(),
  channel_id       uuid not null references public.listing_channels(id) on delete restrict,
  room_id          uuid not null references public.rooms(id) on delete restrict,
  idempotency_key  text,
  move_in          date not null,
  duration_months  numeric not null check (duration_months > 0),
  applicant_name   text not null,
  applicant_email  text not null,
  applicant_phone  text,
  applicant_nationality text,
  note             text,
  status           text not null default 'received'
                   check (status in ('received','in_review','confirmed','declined')),
  calendar_id      uuid references public.room_calendar(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
-- Same partner retrying the same submission must not create a second lead.
create unique index if not exists booking_requests_idem_key
  on public.booking_requests (channel_id, idempotency_key)
  where idempotency_key is not null;
create index if not exists booking_requests_channel_idx
  on public.booking_requests (channel_id, created_at desc);

create table if not exists public.webhook_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  channel_id  uuid not null references public.listing_channels(id) on delete cascade,
  url         text not null,
  -- Subset of: listing.calendar.updated, listing.rates.updated,
  -- listing.profile.updated, booking_request.updated
  events      text[] not null,
  secret      text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists webhook_subscriptions_channel_idx
  on public.webhook_subscriptions (channel_id) where active;

-- One row per (event, subscription) delivery attempt chain. The dispatcher
-- delivers PENDING rows; failures stay PENDING with attempts incremented
-- until the cap, then become DEAD. Rows older than 30 days are pruned by the
-- retry sweep's cleanup statement.
create table if not exists public.webhook_deliveries (
  id              uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.webhook_subscriptions(id) on delete cascade,
  event_type      text not null,
  payload         jsonb not null,
  status          text not null default 'PENDING'
                  check (status in ('PENDING','DELIVERED','DEAD')),
  attempts        integer not null default 0,
  last_error      text,
  created_at      timestamptz not null default now(),
  delivered_at    timestamptz
);
create index if not exists webhook_deliveries_pending_idx
  on public.webhook_deliveries (status, created_at) where status = 'PENDING';

-- Minimal audit: who called what, when, how it went. No bodies stored.
create table if not exists public.api_request_log (
  id         bigint generated always as identity primary key,
  key_id     uuid references public.channel_api_keys(id) on delete set null,
  method     text not null,
  path       text not null,
  status     integer not null,
  ms         integer,
  created_at timestamptz not null default now()
);
create index if not exists api_request_log_key_time_idx
  on public.api_request_log (key_id, created_at desc);

-- Service role only. Enabling RLS with no policies denies anon/authenticated.
alter table public.channel_api_keys      enable row level security;
alter table public.booking_requests      enable row level security;
alter table public.webhook_subscriptions enable row level security;
alter table public.webhook_deliveries    enable row level security;
alter table public.api_request_log       enable row level security;

commit;
