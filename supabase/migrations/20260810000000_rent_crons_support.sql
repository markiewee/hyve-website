-- Rent generation + verification: the schema the two crons need.
--
-- Context. 20260809000000 gave every existing rent row a payment_ref so a bank
-- credit can be matched deterministically instead of by fuzzy name. It stopped
-- one step short: nothing mints a ref on INSERT, and the unique index permits
-- multiple nulls, so every NEW row silently reverts to the unmatchable state
-- the whole exercise existed to fix. Verified on production with a rolled-back
-- test insert: payment_ref came back null.
--
-- This migration closes that, adds the columns the late-fee ladder needs once
-- it stops reading `invoices`, and schedules the two crons.

begin;

-- ── 1. Mint payment_ref on insert ───────────────────────────────────────────
-- In the database rather than in the cron, because three code paths write rent
-- rows today (the admin Generate button, the coming cron, and hand-written SQL)
-- and a format duplicated three times will drift.

create or replace function public.fn_rent_payments_mint_ref()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  unit   text;
  base   text;
  suffix int := 1;
  final  text;
begin
  if new.payment_ref is not null then
    return new;
  end if;

  select upper(replace(coalesce(r.unit_code, 'UNK'), '-', ''))
    into unit
    from public.rooms r
   where r.id = new.room_id;

  base  := 'LB-' || coalesce(unit, 'UNK') || '-' || to_char(new.month, 'YYMM');
  final := base;

  -- A tenant can only hold one row per month, so a collision here means a room
  -- changed hands mid-month. Suffix rather than fail: billing must not block.
  while exists (select 1 from public.rent_payments where payment_ref = final) loop
    suffix := suffix + 1;
    final  := base || '-' || suffix;
  end loop;

  new.payment_ref := final;
  return new;
end;
$$;

comment on function public.fn_rent_payments_mint_ref is
  'Mints rent_payments.payment_ref (LB-<UNITCODE>-<YYMM>) on insert. This is the '
  'code the tenant quotes in their PayNow reference and the only deterministic '
  'key verification has to match a bank credit against.';

drop trigger if exists trg_rent_payments_mint_ref on public.rent_payments;
create trigger trg_rent_payments_mint_ref
  before insert on public.rent_payments
  for each row execute function public.fn_rent_payments_mint_ref();

-- ── 2. Late-fee ladder state ────────────────────────────────────────────────
-- check-late-fees currently reads `invoices` (1 row, ever) while the business
-- writes rent_payments (104 rows). Repointing it needs the per-row reminder
-- state that only `invoices` carried.

alter table public.rent_payments
  add column if not exists late_fee_applied_at        timestamptz,
  add column if not exists late_fee_count             integer not null default 0,
  add column if not exists last_reminder_at           timestamptz,
  add column if not exists last_reminder_days_overdue integer not null default 0;

comment on column public.rent_payments.late_fee_count is
  'How many 5% late fees have been applied. Explicit rather than inferred from '
  'the late_fee amount, which cannot distinguish two fees from one fee on a '
  'larger balance.';

comment on column public.rent_payments.last_reminder_days_overdue is
  'Days-overdue at the last reminder. Guards against re-sending the same rung '
  'of the ladder when the cron runs more than once in a day.';

-- Per-tenant waive, for the cases where chasing is the wrong move (a dispute
-- in progress, a settled arrangement, a departing tenant).
alter table public.tenant_profiles
  add column if not exists late_fee_waived boolean not null default false;

comment on column public.tenant_profiles.late_fee_waived is
  'When true the late-fee ladder skips this tenant entirely. Set by an admin, '
  'never by automation.';

-- ── 3. Verification run log ─────────────────────────────────────────────────
-- Unmatched credits are the interesting output: money arrived that we cannot
-- attribute. That is a queue for a human, so it has to be durable, not a log line.

create table if not exists public.rent_verification_runs (
  id            uuid primary key default gen_random_uuid(),
  ran_at        timestamptz not null default now(),
  window_from   date        not null,
  window_to     date        not null,
  credits_seen  integer     not null default 0,
  matched       integer     not null default 0,
  partial       integer     not null default 0,
  unmatched     jsonb       not null default '[]'::jsonb,
  error         text,
  created_at    timestamptz not null default now()
);

comment on table public.rent_verification_runs is
  'One row per verify-rent run. `unmatched` holds the bank credits that arrived '
  'with no payment_ref we recognise: real money we cannot attribute, which is a '
  'human queue rather than a log line.';

create index if not exists rent_verification_runs_ran_at_idx
  on public.rent_verification_runs (ran_at desc);

alter table public.rent_verification_runs enable row level security;

-- Admins only. This holds counterparty names and amounts.
drop policy if exists "Admin read verification runs" on public.rent_verification_runs;
create policy "Admin read verification runs"
  on public.rent_verification_runs for select
  using (
    exists (
      select 1 from public.tenant_profiles tp
       where tp.user_id = auth.uid()
         and tp.role = any (array['ADMIN', 'SUPER_ADMIN'])
         and tp.is_active = true
    )
  );

-- ── 4. Schedules ────────────────────────────────────────────────────────────
-- The service key comes from the vault. The existing check-late-fees job has
-- the key pasted into cron.job.command in clear text, which means anyone who
-- can read cron.job holds a service-role credential. Not repeating that.
--
-- Requires, once, out of band and NOT in this file:
--   select vault.create_secret('<service role key>', 'SERVICE_ROLE_KEY');

-- Note the shape carefully: the command reads the vault AT RUN TIME. Baking
-- the key in with format() would put it straight back into cron.job.command
-- in clear text, which is the thing being fixed.

create or replace function public.fn_schedule_rent_cron(job_name text, sched text, fn text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform cron.unschedule(job_name)
    where exists (select 1 from cron.job where jobname = job_name);

  perform cron.schedule(job_name, sched, format($q$
    select net.http_post(
      url := %L,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret from vault.decrypted_secrets
           where name = 'SERVICE_ROLE_KEY')),
      body := '{}'::jsonb)
  $q$, 'https://diiilqpfmlxjwiaeophb.supabase.co/functions/v1/' || fn));
end;
$$;

comment on function public.fn_schedule_rent_cron is
  'Schedules an edge-function cron whose command resolves the service key from '
  'the vault at run time, so no credential is stored in cron.job.command.';

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'SERVICE_ROLE_KEY') then
    raise warning 'SERVICE_ROLE_KEY not in vault: rent crons NOT scheduled. '
                  'Run select vault.create_secret(''<key>'', ''SERVICE_ROLE_KEY''); '
                  'then re-run this block.';
    return;
  end if;

  -- Generation runs on the 1st at 16:20 UTC, which is 00:20 SGT on the 2nd.
  -- Billing a few hours into the month is harmless; chasing month-length edge
  -- cases to bill at midnight SGT sharp is not worth the fragility.
  perform public.fn_schedule_rent_cron('generate-rent-monthly', '20 16 1 * *', 'generate-rent');
  perform public.fn_schedule_rent_cron('verify-rent-halfhourly', '*/30 * * * *', 'verify-rent');

  -- Same schedule as before (01:00 UTC, 09:00 SGT), rescheduled only to get
  -- the pasted service-role key out of cron.job.command. Anyone able to read
  -- cron.job was holding a service-role credential.
  perform public.fn_schedule_rent_cron('check-late-fees-daily', '0 1 * * *', 'check-late-fees');
end;
$$;

commit;
