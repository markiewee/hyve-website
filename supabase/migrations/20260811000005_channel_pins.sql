-- Human platforms.
--
-- An agent is not a different kind of thing from Spotahome, it is a channel we
-- reach through a person instead of a browser worker. Same base price, same
-- modifier, same commission arithmetic. The only difference is how they get in:
-- a machine channel is published to, a human channel is unlocked with a PIN.
--
-- So no AGENT role, no portal accounts, no onboarding flow. A PIN resolves to a
-- channel and the booking site prices itself accordingly.
--
-- PINs are per PERSON, not per channel, which is the whole point: three agents
-- can all sit on the `agent` channel and you still know which of them is
-- actually working your inventory, and you can kill one without touching the
-- other two.

create table if not exists public.channel_pins (
  pin          text primary key,
  channel_id   uuid not null references public.listing_channels(id) on delete cascade,
  label        text not null,
  enabled      boolean not null default true,
  note         text,
  last_used_at timestamptz,
  use_count    integer not null default 0,
  created_at   timestamptz not null default now(),

  -- Six digits, no letters. These get read out over the phone and typed on a
  -- phone keypad, so ambiguity between O and 0 is not worth the entropy.
  constraint channel_pins_format check (pin ~ '^[0-9]{6}$')
);

comment on table public.channel_pins is
  'A PIN unlocks one channel''s pricing on the booking site. One row per person '
  'so usage is attributable and a single PIN can be revoked on its own.';
comment on column public.channel_pins.label is
  'Who holds it, e.g. "Serena, PropNex". Shown in the admin list, never public.';

create index if not exists channel_pins_channel_idx on public.channel_pins (channel_id);

-- ── the pricing rule, in SQL ────────────────────────────────────────────────
--
-- The same arithmetic already lives in _shared/channelPricing.js for the admin
-- screen. It is repeated here rather than shared because the booking site is a
-- separate Next.js app in another repo, and two apps calling one database
-- function is a better single source of truth than two apps importing one file
-- across a repo boundary.
--
-- Two implementations can drift, so channelPricing.test.js asserts the same
-- fixtures this function is checked against. If you change one, change both.

create or replace function public.channel_uplift(
  p_channel_id uuid,
  p_lease_months numeric
) returns numeric
language plpgsql
stable
as $$
declare
  c record;
  months numeric;
  pct numeric;
begin
  if p_lease_months is null or p_lease_months <= 0 then
    raise exception 'lease_months must be positive, got %', p_lease_months;
  end if;

  select commission_months, commission_pct, gross_up
    into c
    from public.listing_channels
   where id = p_channel_id;

  if not found then
    raise exception 'no such channel %', p_channel_id;
  end if;

  -- We have chosen to absorb this channel's cost rather than pass it on.
  if c.gross_up is false then
    return 1;
  end if;

  months := coalesce(c.commission_months, 0);
  pct    := coalesce(c.commission_pct, 0);

  if months > 0 and pct > 0 then
    raise exception 'channel % sets both commission fields', p_channel_id;
  end if;

  if months > 0 then
    -- Divide, do not multiply: the agent takes a month of the QUOTED rent, so
    -- base * (1 + c/L) would hand them a commission on their own commission.
    if months >= p_lease_months then
      raise exception 'commission of % months exceeds a % month lease', months, p_lease_months;
    end if;
    return p_lease_months / (p_lease_months - months);
  end if;

  if pct > 0 then
    if pct >= 1 then
      raise exception 'commission_pct % must be below 1', pct;
    end if;
    return 1 / (1 - pct);
  end if;

  return 1;
end;
$$;

-- ── what a PIN holder sees ──────────────────────────────────────────────────
--
-- One call: hand it a PIN and a lease length, get every sellable room at that
-- channel's price plus the commission on each. Security-relevant detail: this
-- returns prices and commission ONLY. No tenant data, no occupancy, nothing
-- that matters if a PIN leaks. A leaked PIN is a commercial annoyance, and it
-- should never be able to become anything worse.

create or replace function public.rooms_for_pin(
  p_pin text,
  p_lease_months numeric default 12
) returns table (
  unit_code        text,
  base_hidden      boolean,
  quoted_monthly   numeric,
  commission_total numeric,
  channel_slug     text,
  channel_name     text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  pin_row record;
  ch record;
  uplift numeric;
begin
  select * into pin_row from public.channel_pins
   where pin = p_pin and enabled = true;
  if not found then
    return; -- empty set, not an error: do not confirm which PINs exist
  end if;

  select * into ch from public.listing_channels where id = pin_row.channel_id;
  if not found or ch.enabled is false then
    return;
  end if;

  uplift := public.channel_uplift(ch.id, p_lease_months);

  return query
  select r.unit_code::text,
         true as base_hidden,
         round(r.price_monthly * uplift
               + coalesce(ch.fee_fixed, 0) / p_lease_months)::numeric,
         case
           when coalesce(ch.commission_months, 0) > 0
             then round(r.price_monthly * uplift
                        + coalesce(ch.fee_fixed, 0) / p_lease_months) * ch.commission_months
           when coalesce(ch.commission_pct, 0) > 0
             then round(r.price_monthly * uplift
                        + coalesce(ch.fee_fixed, 0) / p_lease_months)
                  * p_lease_months * ch.commission_pct
           else 0
         end::numeric,
         ch.slug::text,
         ch.name::text
    from public.rooms r
   where r.price_monthly is not null
   order by r.unit_code;
end;
$$;

-- The booking site is anonymous, so the PIN lookup has to be callable without a
-- session. security definer above is what lets it read listing_channels without
-- exposing that table itself.
grant execute on function public.rooms_for_pin(text, numeric) to anon, authenticated;
grant execute on function public.channel_uplift(uuid, numeric) to authenticated;

-- channel_pins itself stays admin-only. The anon role never reads it directly;
-- it only ever goes through rooms_for_pin, which returns no rows for a bad PIN
-- rather than saying so.
alter table public.channel_pins enable row level security;

drop policy if exists channel_pins_admin_all on public.channel_pins;
create policy channel_pins_admin_all on public.channel_pins
  for all to authenticated
  using (
    exists (select 1 from public.tenant_profiles tp
             where tp.user_id = auth.uid() and tp.role = 'ADMIN')
  )
  with check (
    exists (select 1 from public.tenant_profiles tp
             where tp.user_id = auth.uid() and tp.role = 'ADMIN')
  );
