-- Channel worker contract v1, part 1: state.
-- Spec: docs/integrations/channel-worker-contract-v1.md
-- Data shape only. Every guard and behaviour lives in part 2 so that the rules
-- cannot be bypassed by a worker writing a column directly.

begin;

-- ── Observed state, and the claim ───────────────────────────────────────────
alter table public.listing_placements
  add column if not exists observed_state       jsonb,
  add column if not exists observed_at          timestamptz,
  add column if not exists claimed_by           text,
  add column if not exists claim_token          uuid,
  add column if not exists claim_expires_at     timestamptz,
  add column if not exists approved_at          timestamptz,
  add column if not exists approved_by          uuid,
  add column if not exists consecutive_failures integer not null default 0,
  add column if not exists push_count_date      date,
  add column if not exists push_count           integer not null default 0,
  add column if not exists frozen_reason        text;

comment on column public.listing_placements.observed_state is
  'What the platform ACTUALLY showed when a worker last looked. Never what a '
  'worker intended to set. Spec section 4.2.';
comment on column public.listing_placements.claim_token is
  'Issued by fn_claim_listing_work. A report carrying a stale token is rejected, '
  'so a worker that stalled past its claim cannot overwrite a newer result.';
comment on column public.listing_placements.frozen_reason is
  'Non-null means no worker will claim this placement until a human clears it.';

-- ── Who is out there, and is it alive ───────────────────────────────────────
create table if not exists public.channel_workers (
  worker_id    text        primary key,
  channel_slug text        not null references public.listing_channels(slug),
  last_seen_at timestamptz not null default now(),
  note         jsonb,
  created_at   timestamptz not null default now()
);

comment on table public.channel_workers is
  'Registered workers. Also the liveness signal: a worker that is asleep, '
  'crashed or unplugged produces exactly the same database as one with nothing '
  'to do, so absence of a heartbeat is the only way to tell them apart.';

-- ── Every attempt, attributable ─────────────────────────────────────────────
create table if not exists public.listing_push_log (
  id           uuid        primary key default gen_random_uuid(),
  placement_id uuid        not null references public.listing_placements(id) on delete cascade,
  worker_id    text        not null,
  at           timestamptz not null default now(),
  intent       jsonb,
  observed     jsonb,
  ok           boolean     not null,
  error        text
);

create index if not exists listing_push_log_placement_at_idx
  on public.listing_push_log (placement_id, at desc);

comment on table public.listing_push_log is
  'One row per worker attempt. Answers "who turned that listing off, and when".';

-- ── RLS: workers reach these only through security-definer functions ────────
alter table public.channel_workers   enable row level security;
alter table public.listing_push_log  enable row level security;

revoke all on public.channel_workers  from anon, authenticated;
revoke all on public.listing_push_log from anon, authenticated;

commit;
