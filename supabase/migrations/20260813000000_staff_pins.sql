-- Staff access PINs for the room desk at /staff.
--
-- Modelled directly on channel_pins (20260811000005). Same reasoning: one row
-- per person so usage is attributable and a single PIN can be revoked on its
-- own, six digits because these get read out loud and typed on a phone.
--
-- What this protects is the page, not the data. rooms is anon-readable by
-- design so the public booking site can render listings, and the anon key ships
-- in the client bundle. tenant_profiles is the sensitive one and its own RLS
-- already keeps it out of reach. This gate exists so the internal tool is not
-- sitting on a guessable URL for anyone who wanders past.
--
-- A staff PIN is NOT the credential for an agent or an aggregator. That is
-- channel_pins, which shows a partner their own quoted prices on the booking
-- site and never the internal ladder or the vacancy pipeline.

create table if not exists public.staff_pins (
  pin          text primary key,
  label        text not null,
  enabled      boolean not null default true,
  note         text,
  last_used_at timestamptz,
  use_count    integer not null default 0,
  created_at   timestamptz not null default now(),

  constraint staff_pins_format check (pin ~ '^[0-9]{6}$')
);

comment on table public.staff_pins is
  'A PIN opens the staff room desk at /staff. One row per person so usage is '
  'attributable and a single PIN can be revoked without changing everyone else''s.';
comment on column public.staff_pins.label is
  'Who holds it, e.g. "Edward, IH captain". Shown in the admin list, never public.';

-- ── redeeming a PIN ─────────────────────────────────────────────────────────
--
-- Returns true or false, and records the use. security definer is what lets an
-- anonymous caller check a PIN without staff_pins itself ever being readable.
--
-- A wrong PIN returns false rather than raising, and the function never reveals
-- whether a given PIN exists but is disabled: both cases look identical.

create or replace function public.redeem_staff_pin(p_pin text)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  ok boolean := false;
begin
  update public.staff_pins
     set use_count = use_count + 1,
         last_used_at = now()
   where pin = p_pin
     and enabled = true;

  if found then
    ok := true;
  end if;

  return ok;
end;
$$;

-- The room desk is opened by people without portal accounts, so the check has
-- to be callable with no session at all.
grant execute on function public.redeem_staff_pin(text) to anon, authenticated;

-- staff_pins itself stays admin-only. The anon role never reads it directly, it
-- only ever goes through redeem_staff_pin.
alter table public.staff_pins enable row level security;

drop policy if exists staff_pins_admin_all on public.staff_pins;
create policy staff_pins_admin_all on public.staff_pins
  for all to authenticated
  using (
    exists (select 1 from public.tenant_profiles tp
             where tp.user_id = auth.uid() and tp.role = 'ADMIN')
  )
  with check (
    exists (select 1 from public.tenant_profiles tp
             where tp.user_id = auth.uid() and tp.role = 'ADMIN')
  );
